import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Category, Item } from '../models/schemas';

const router = Router();

router.use(requireAuth);

/* GET /api/categories - Get all categories for the logged-in user */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    
    const categories = await Category.find({ user_id: userId });
    
    // Get item count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const itemCount = await Item.countDocuments({ category_id: category._id });
        return {
          id: category._id,
          name: category.name,
          description: category.description,
          created_at: category.created_at,
          item_count: itemCount
        };
      })
    );

    res.json(categoriesWithCount);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/* POST /api/categories - Create a new category */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category name already exists
    const existingCategory = await Category.findOne({ user_id: userId, name });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    const category = await Category.create({
      user_id: userId,
      name,
      description: description || undefined
    });

    res.status(201).json({ 
      message: 'Category created successfully',
      categoryId: category._id
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/* PUT /api/categories/:id - Update a category */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const categoryId = req.params.id;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category exists and belongs to user
    const category = await Category.findOne({ _id: categoryId, user_id: userId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if new category name already exists
    const existingCategory = await Category.findOne({ 
      user_id: userId, 
      name, 
      _id: { $ne: categoryId } 
    });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    category.name = name;
    category.description = description || undefined;
    await category.save();

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/* DELETE /api/categories/:id - Delete a category */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const categoryId = req.params.id;

    const result = await Category.deleteOne({ _id: categoryId, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await Item.updateMany({ category_id: categoryId }, { $unset: { category_id: "" } });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;