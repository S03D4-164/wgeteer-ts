import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const requestSchema = new Schema({
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
  webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  response: { type: mongoose.Schema.Types.ObjectId, ref: 'Response' },
});

type requestModelType = InferSchemaType<typeof requestSchema>;

requestSchema.index({ createdAt: -1 });
requestSchema.index({ webpage: 1 });

requestSchema.plugin(paginate);

const RequestModel = model<requestModelType, PaginateModel<requestModelType>>(
  'Request',
  requestSchema,
);

export default RequestModel;
export { requestModelType };
