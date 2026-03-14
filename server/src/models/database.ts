import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/property-archive';

/* Initialize MongoDB connection */
export async function initDatabase(): Promise<void> {
  try {
    console.log('🗄️  Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB error:', error);
});

export default mongoose;