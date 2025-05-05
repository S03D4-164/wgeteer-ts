import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

// Define the interface for the Payload document
export interface IPayload extends Document {
  payload: Buffer;
  md5: string;
  fileType: string;
  vt?: Record<string, any>;
  createdAt?: Date;
  tag?: Record<string, any>[];
  yara?: Record<string, any>;
}

// Define the schema
const payloadSchema: Schema<IPayload> = new Schema(
  {
    payload: {
      type: Buffer,
      required: true,
    },
    md5: {
      type: String,
      unique: true,
      required: true,
    },
    fileType: {
      type: String,
    },
    vt: {
      type: Object,
    },
    tag: {
      type: [Object],
    },
    yara: {
      type: Object,
    },
  },
  { timestamps: true, read: 'secondaryPreferred' },
);

payloadSchema.index({ createdAt: -1 });
payloadSchema.plugin(mongoosePaginate);

// Export the model
const PayloadModel: Model<IPayload> = mongoose.model<IPayload, mongoose.PaginateModel<IPayload>>('Payload', payloadSchema);
export default PayloadModel;

