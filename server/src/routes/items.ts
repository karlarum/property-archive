import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Item, Category } from '../models/schemas';
import { generateImageDescription } from '../services/aiService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require authentication
router.use(requireAuth);

/* GET /api/items - Get all items for the logged-in user */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    
    const items = await Item.find({ user_id: userId })
      .populate('category_id', 'name')
      .sort({ created_at: -1 });

    const itemsFormatted = items.map(item => ({
      id: item._id,
      name: item.name,
      description: item.description,
      category_id: item.category_id,
      category_name: item.category_id ? (item.category_id as any).name : null,
      purchase_date: item.purchase_date,
      purchase_price: item.purchase_price,
      location: item.location,
      photo_count: item.photos.length,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    res.json(itemsFormatted);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/* GET /api/items/:id - Get a single item with photos */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;

    const item = await Item.findOne({ _id: itemId, user_id: userId })
      .populate('category_id', 'name');

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemFormatted = {
      id: item._id,
      name: item.name,
      description: item.description,
      category_id: item.category_id,
      category_name: item.category_id ? (item.category_id as any).name : null,
      purchase_date: item.purchase_date,
      purchase_price: item.purchase_price,
      location: item.location,
      photos: item.photos.map((filename, index) => ({
        id: index,
        filename,
        filepath: `/uploads/${filename}`
      })),
      created_at: item.created_at,
      updated_at: item.updated_at
    };

    res.json(itemFormatted);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

/* POST /api/items - Create a new item */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { name, description, categoryId, purchaseDate, purchasePrice, location } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const item = await Item.create({
      user_id: userId,
      category_id: categoryId || undefined,
      name,
      description: description || undefined,
      purchase_date: purchaseDate || undefined,
      purchase_price: purchasePrice || undefined,
      location: location || undefined,
      photos: []
    });

    res.status(201).json({ 
      message: 'Item created successfully',
      itemId: item._id
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

/* PUT /api/items/:id - Update an item */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;
    const { name, description, categoryId, purchaseDate, purchasePrice, location } = req.body;

    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    item.name = name;
    item.description = description || undefined;
    item.category_id = categoryId || undefined;
    item.purchase_date = purchaseDate || undefined;
    item.purchase_price = purchasePrice || undefined;
    item.location = location || undefined;
    item.updated_at = new Date();

    await item.save();

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/* DELETE /api/items/:id - Delete an item */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;

    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete photo files
    item.photos.forEach(filename => {
      try {
        const filepath = path.join(__dirname, '../../uploads', filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (err) {
        console.error('Error deleting photo file:', err);
      }
    });

    await Item.deleteOne({ _id: itemId });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

/* POST /api/items/:id/photos - Upload photos for an item (with AI description) */
router.post('/:id/photos', upload.array('photos', 5), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Find the item
    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ error: 'Item not found' });
    }

    // Add photo filenames to item
    const photoFilenames = files.map(file => file.filename);
    item.photos.push(...photoFilenames);
    
    // Generate AI description from first photo if item has no description
    if (!item.description && files.length > 0) {
      const firstPhotoPath = files[0].path;
      const aiDescription = await generateImageDescription(firstPhotoPath);
      if (aiDescription) {
        item.description = aiDescription;
      }
    }
    
    await item.save();

    res.json({ 
      message: 'Photos uploaded successfully',
      photoCount: item.photos.length,
      aiDescription: item.description || null
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

/* DELETE /api/items/:itemId/photos/:photoIndex - Delete a photo */
router.delete('/:itemId/photos/:photoIndex', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { itemId, photoIndex } = req.params;
    const index = parseInt(photoIndex);

    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (index < 0 || index >= item.photos.length) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const filename = item.photos[index];
    
    const filepath = path.join(__dirname, '../../uploads', filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Remove from array
    item.photos.splice(index, 1);
    await item.save();

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;