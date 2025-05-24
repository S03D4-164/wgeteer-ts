import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';
import { mongoosastic } from 'mongoosastic-ts';
import {
  MongoosasticDocument,
  MongoosasticModel,
  MongoosasticPluginOpts,
} from 'mongoosastic-ts/dist/types';

const responseSchema = new Schema(
  {
    url: {
      type: String,
      es_indexed: true,
    },
    urlHash: {
      type: String,
    },
    status: {
      type: Number,
    },
    statusText: {
      type: String,
    },
    ok: {
      type: Boolean,
    },
    text: {
      type: String,
      es_indexed: true,
    },
    remoteAddress: {
      ip: { type: String },
      port: { type: Number },
      reverse: { type: [String] },
      bgp: { type: [Object] },
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
    createdAt: {
      type: Date,
      default: Date.now,
    },
    wappalyzer: {
      type: [String],
    },
    yara: {
      type: Object,
    },
    interceptionId: {
      type: String,
    },
    webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    payload: { type: mongoose.Schema.Types.ObjectId, ref: 'Payload' },
  },
  { timestamps: false },
);

type responseModelType = InferSchemaType<typeof responseSchema>;

responseSchema.plugin(paginate);
//responseSchema.plugin(mongoosastic);

responseSchema.index({ createdAt: -1 });
responseSchema.index({ urlHash: 1 });
responseSchema.index({ payload: 1 });
responseSchema.index({ text: 'text' });
responseSchema.index({ webpage: 1 });
responseSchema.index({ 'remoteAddress.ip': 1 });

const ResponseModel = model<
  responseModelType,
  PaginateModel<responseModelType, MongoosasticModel<responseModelType>>
>('Response', responseSchema);

export default ResponseModel;
export { responseModelType };
