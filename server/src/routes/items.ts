import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { Item, Category } from '../models/schemas';
import { generateImageDescription } from '../services/aiService';
import { uploadToR2, deleteFromR2, getSignedUrlFromR2 } from '../services/r2Service';
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

router.use(requireAuth);

/* GET /api/items - Get all items for the logged-in user with signed URLs */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    
    const items = await Item.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: { $toString: '$_id' },
          name: 1,
          description: 1,
          category_id: { $toString: '$category_id' },
          category_name: '$category.name',
          location: 1,
          purchase_date: 1,
          purchase_price: 1,
          quantity: 1,
          photos: 1,
          photo_count: { $size: { $ifNull: ['$photos', []] } },
          created_at: 1
        }
      },
      { $sort: { created_at: -1 } }
    ]);

    // Signed URLs for photos
    for (const item of items) {
      if (item.photos && item.photos.length > 0) {
        item.photoUrls = await Promise.all(
          item.photos.map((filename: string) => getSignedUrlFromR2(filename))
        );
      }
    }

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/* GET /api/items/:id - Get a single item with signed photo URLs */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;

    const items = await Item.aggregate([
      { 
        $match: { 
          _id: new mongoose.Types.ObjectId(itemId),
          user_id: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: { $toString: '$_id' },
          name: 1,
          description: 1,
          category_id: { $toString: '$category_id' },
          category_name: '$category.name',
          location: 1,
          purchase_date: 1,
          purchase_price: 1,
          quantity: 1,
          photos: 1,
          created_at: 1
        }
      }
    ]);

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];

    // Generate signed URLs for photos
    if (item.photos && item.photos.length > 0) {
      item.photoUrls = await Promise.all(
        item.photos.map((filename: string) => getSignedUrlFromR2(filename))
      );
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

/* POST /api/items - Create a new item */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { name, description, categoryId, purchaseDate, purchasePrice, location, quantity } = req.body;

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
      quantity: quantity ? parseInt(quantity) : 1,
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
    const { name, description, categoryId, purchaseDate, purchasePrice, location, quantity } = req.body;

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
    item.quantity = quantity ? parseInt(quantity) : 1;
    item.updated_at = new Date();

    await item.save();

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/* DELETE /api/items/:id - Delete an item and all its photos from R2 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;

    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete all photos from R2
    if (item.photos && item.photos.length > 0) {
      await Promise.all(
        item.photos.map(filename => deleteFromR2(filename))
      );
    }

    // Delete item from database
    await Item.deleteOne({ _id: itemId });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

/* POST /api/items/:id/photos - Upload photos for an item (with AI description) - saves to R2 */
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

    // Generate AI description from first photo before uploading to R2
    if (!item.description && files.length > 0) {
      const firstPhotoPath = files[0].path;
      const aiDescription = await generateImageDescription(firstPhotoPath);
      if (aiDescription) {
        item.description = aiDescription;
      }
    }

    // Upload photos to R2
    const uploadPromises = files.map(file => uploadToR2(file.path, file.filename));
    const photoFilenames = await Promise.all(uploadPromises);
    
    // Add photo filenames to item
    item.photos.push(...photoFilenames);
    
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

/* DELETE /api/items/:id/photos/:filename - Delete a specific photo from R2 */
router.delete('/:id/photos/:filename', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const itemId = req.params.id;
    const filename = req.params.filename;

    const item = await Item.findOne({ _id: itemId, user_id: userId });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Remove from R2
    await deleteFromR2(filename);

    // Remove from database
    item.photos = item.photos.filter(photo => photo !== filename);
    await item.save();

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;