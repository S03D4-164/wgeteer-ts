import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

interface IResponse extends Document {
  url?: string;
  urlHash?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  text?: string;
  remoteAddress?: {
    ip?: string;
    port?: number;
    reverse?: string[];
    bgp?: any[];
    geoip?: any[];
  };
  headers?: Record<string, any>;
  securityDetails?: {
    issuer?: string;
    protocol?: string;
    subjectName?: string;
    validFrom?: number;
    validTo?: number;
  };
  createdAt?: Date;
  wappalyzer?: string[];
  yara?: Record<string, any>;
  interceptionId?: string;
  webpage?: mongoose.Types.ObjectId;
  request?: mongoose.Types.ObjectId;
  payload?: mongoose.Types.ObjectId;
}

const responseSchema: Schema<IResponse> = new Schema(
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

responseSchema.index({ createdAt: -1 });
responseSchema.index({ urlHash: 1 });
responseSchema.index({ payload: 1 });
responseSchema.index({ text: 'text' });
responseSchema.index({ webpage: 1 });
responseSchema.index({ 'remoteAddress.ip': 1 });

responseSchema.plugin(mongoosePaginate);

const ResponseModel: Model<IResponse> = mongoose.model<IResponse, mongoose.PaginateModel<IResponse>>('Response', responseSchema);

export default ResponseModel;
