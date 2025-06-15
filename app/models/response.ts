import mongoose, {
  Schema,
  InferSchemaType,
  model,
  PaginateModel,
} from 'mongoose';
import paginate from 'mongoose-paginate-v2';
/*
import mongoosastic from 'mongoosastic';
import { Client } from '@elastic/elasticsearch';
const esClient = new Client({ node: 'http://127.0.0.1:9200' });
esClient.info().then(console.log, console.log);
*/

const responseSchema = new Schema(
  {
    url: {
      type: String,
      //es_indexed: true,
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
      //es_indexed: true,
    },
    mimeType: {
      type: String,
    },
    encoding: {
      type: String,
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
/*
responseSchema.plugin(mongoosastic as any, {
  esClient: esClient,
  bulk: {
    size: 10, // preferred number of docs to bulk index
    delay: 100, //milliseconds to wait for enough docs to meet size constraint
  },
});
*/

responseSchema.index({ createdAt: -1 });
responseSchema.index({ urlHash: 1 });
responseSchema.index({ payload: 1 });
responseSchema.index({ text: 'text' });
responseSchema.index({ webpage: 1 });
responseSchema.index({ 'remoteAddress.ip': 1 });

const ResponseModel = model<
  responseModelType,
  PaginateModel<responseModelType>
>('Response', responseSchema);

export default ResponseModel;
export { responseModelType };
