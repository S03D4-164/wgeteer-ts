import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const webpageSchema = new Schema(
  {
    input: {
      type: String,
      trim: true,
      required: true,
    },
    option: {
      type: Object,
    },
    url: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
    },
    error: {
      type: String,
    },
    thumbnail: {
      type: String,
    },
    thumbnails: [
      {
        type: String,
      },
    ],
    content: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: Number,
    },
    remoteAddress: {
      ip: { type: String, index: true },
      port: { type: Number },
      reverse: { type: [String] },
      bgp: { type: [Object] },
      whois: { type: String },
      geoip: { type: [Object] },
    },
    headers: {
      type: Object,
    },
    securityDetails: {
      issuer: { type: String },
      protocol: { type: String },
      subjectName: { type: String },
      validFrom: { type: Number },
      validTo: { type: Number },
    },
    wappalyzer: {
      type: [String],
    },
    yara: {
      type: Object,
    },
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Request' }],
    responses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Response' }],
    screenshot: { type: mongoose.Schema.Types.ObjectId, ref: 'Screenshot' },
    screenshots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Screenshot' }],
    payload: { type: mongoose.Schema.Types.ObjectId, ref: 'Payload' },
    harfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Harfile' },
  },
  { timestamps: false },
);

type webpageModelType = InferSchemaType<typeof webpageSchema>;

webpageSchema.plugin(paginate);

webpageSchema.index({ createdAt: -1 });
webpageSchema.index({ content: 'text' });
webpageSchema.index({ input: 1, createdAt: -1 });

const WebpageModel = model<webpageModelType, PaginateModel<webpageModelType>>(
  'Webpage',
  webpageSchema,
);
export default WebpageModel;
export { webpageModelType };
