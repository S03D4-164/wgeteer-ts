import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

// Define the interface for the GSB document
export interface IGSB extends Document {
  api?: string;
  url: string;
  urlHash?: string;
  result?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the schema
const gsbSchema = new Schema<IGSB>(
  {
    api: {
      type: String,
    },
    url: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    urlHash: {
      type: String,
    },
    result: {
      type: Object,
    },
  },
  { timestamps: true },
);

// Add plugins and indexes
gsbSchema.plugin(mongoosePaginate);
gsbSchema.index({ createdAt: -1 });
gsbSchema.index({ urlHash: 1 });

// Export the model
const GSBModel: Model<IGSB> = mongoose.model<IGSB>('gsb', gsbSchema);
export default GSBModel;
