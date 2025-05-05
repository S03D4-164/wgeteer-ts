import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IRequest extends mongoose.Document {
  url?: string;
  method?: string;
  resourceType?: string;
  isNavigationRequest?: boolean;
  postData?: string;
  failure?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  redirectChain?: string[];
  createdAt?: Date;
  interceptionId?: string;
  webpage?: mongoose.Types.ObjectId;
  response?: mongoose.Types.ObjectId;
}

const requestSchema = new mongoose.Schema({
  url: {
    type: String,
  },
  method: {
    type: String,
  },
  resourceType: {
    type: String,
  },
  isNavigationRequest: {
    type: Boolean,
  },
  postData: {
    type: String,
  },
  failure: {
    type: Object,
  },
  headers: {
    type: Object,
  },
  redirectChain: {
    type: [String],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  interceptionId: {
    type: String,
  },
  webpage: { type: mongoose.Types.ObjectId, ref: "Webpage" },
  response: { type: mongoose.Types.ObjectId, ref: "Response" },
});

requestSchema.index({ createdAt: -1 });
requestSchema.index({ webpage: 1 });

requestSchema.plugin(mongoosePaginate);

const RequestModel: Model<IRequest> = mongoose.model<IRequest, mongoose.PaginateModel<IRequest>>('Request', requestSchema);

export default RequestModel;
