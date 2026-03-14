import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Item } from '../models/schemas';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const router = Router();

router.use(requireAuth);

/* GET /api/export/csv - Export user's inventory to CSV */
router.get('/csv', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    
    const items = await Item.find({ user_id: userId })
      .populate('category_id', 'name')
      .sort({ created_at: -1 });

    // Create CSV content
    const headers = ['Name', 'Description', 'Category', 'Purchase Date', 'Purchase Price', 'Location', 'Photos'];
    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        escapeCsvValue(item.name),
        escapeCsvValue(item.description || ''),
        escapeCsvValue(item.category_id ? (item.category_id as any).name : ''),
        item.purchase_date ? item.purchase_date.toISOString().split('T')[0] : '',
        item.purchase_price || '',
        escapeCsvValue(item.location || ''),
        item.photos.length
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    // Send CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

/* Escape CSV values */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/* GET /api/export/pdf - Export inventory to PDF with photos */
router.get('/pdf', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    
    const items = await Item.find({ user_id: userId })
      .populate('category_id', 'name')
      .sort({ created_at: -1 });

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.pdf');
    
    // Pipe PDF to response
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Property Inventory', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Stats totals
    const totalValue = items.reduce((sum, item) => sum + (item.purchase_price || 0), 0);
    const totalPhotos = items.reduce((sum, item) => sum + item.photos.length, 0);
    
    doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Items: ${items.length}`);
    doc.text(`Total Photos: ${totalPhotos}`);
    doc.text(`Total Estimated Value: $${totalValue.toFixed(2)}`);
    doc.moveDown(2);

    // Items list
    doc.fontSize(14).font('Helvetica-Bold').text('Items', { underline: true });
    doc.moveDown();

    for (const item of items) {
      // Check if new page is needed
      if (doc.y > 650) {
        doc.addPage();
      }

      // Item name
      doc.fontSize(12).font('Helvetica-Bold').text(item.name);
      
      // Category
      if (item.category_id) {
        doc.fontSize(10).font('Helvetica').fillColor('gray')
           .text(`Category: ${(item.category_id as any).name}`)
           .fillColor('black');
      }

      // Description
      if (item.description) {
        doc.fontSize(10).font('Helvetica').text(`Description: ${item.description}`);
      }

      // Details
      doc.fontSize(10);
      if (item.location) doc.text(`Vendor: ${item.location}`);
      if (item.purchase_date) {
        doc.text(`Purchase Date: ${new Date(item.purchase_date).toLocaleDateString()}`);
      }
      if (item.purchase_price) doc.text(`Purchase Price: $${item.purchase_price}`);
      
      // Photos count
      doc.text(`Photos: ${item.photos.length}`);

      // Add first photo if exists
      if (item.photos.length > 0) {
        try {
          const photoPath = path.join(__dirname, '../../uploads', item.photos[0]);
          if (fs.existsSync(photoPath)) {
            doc.moveDown(0.5);
            // Add image
            doc.image(photoPath, { 
              fit: [150, 150]
            });
          }
        } catch (err) {
          console.error('Error adding photo to PDF:', err);
        }
      }

      doc.moveDown(1.5);
      
      // Separator line
      doc.strokeColor('lightgray')
         .lineWidth(0.5)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke()
         .strokeColor('black');
      
      doc.moveDown();
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;