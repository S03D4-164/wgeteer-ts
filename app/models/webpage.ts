import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

export interface IWebpage extends Document {
  input: string;
  option?: Record<string, any>;
  url?: string;
  title?: string;
  error?: string;
  thumbnail?: string;
  thumbnails?: [string];
  content?: string;
  createdAt?: Date;
  status?: number;
  remoteAddress?: {
    ip?: string;
    port?: number;
    reverse?: string[];
    bgp?: any[];
    whois?: string;
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
  wappalyzer?: string[];
  yara?: Record<string, any>;
  requests?: mongoose.Types.ObjectId[];
  responses?: mongoose.Types.ObjectId[];
  screenshot?: mongoose.Types.ObjectId;
  screenshots?: mongoose.Types.ObjectId[];
}

const webpageSchema: Schema<IWebpage> = new Schema(
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
  },
  { timestamps: false },
);

webpageSchema.index({ createdAt: -1 });
webpageSchema.index({ content: 'text' });
webpageSchema.index({ input: 1, createdAt: -1 });

webpageSchema.plugin(mongoosePaginate);

const WebpageModel: Model<IWebpage> = mongoose.model<
  IWebpage,
  mongoose.PaginateModel<IWebpage>
>('Webpage', webpageSchema);

export default WebpageModel;
