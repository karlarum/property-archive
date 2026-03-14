import mongoose, { Schema, Document } from 'mongoose';

// User Schema
export interface IUser extends Document {
  email: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  oauth_provider?: string;
  oauth_id?: string;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String }, // For OAuth users
  first_name: { type: String },
  last_name: { type: String },
  oauth_provider: { type: String },
  oauth_id: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);

// Category Schema
export interface ICategory extends Document {
  user_id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  created_at: Date;
}

const CategorySchema = new Schema<ICategory>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  created_at: { type: Date, default: Date.now }
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

// Item Schema
export interface IItem extends Document {
  user_id: mongoose.Types.ObjectId;
  category_id?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  purchase_date?: Date;
  purchase_price?: number;
  location?: string;
  photos: string[];
  created_at: Date;
  updated_at: Date;
}

const ItemSchema = new Schema<IItem>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: Schema.Types.ObjectId, ref: 'Category' },
  name: { type: String, required: true },
  description: { type: String },
  purchase_date: { type: Date },
  purchase_price: { type: Number },
  location: { type: String },
  photos: [{ type: String }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export const Item = mongoose.model<IItem>('Item', ItemSchema);