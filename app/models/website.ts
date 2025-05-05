import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
//import { PaginateModel } from 'mongoose-paginate-v2';

export interface IWebsite extends Document {
  url: string;
  track: {
    period: number;
    counter: number;
    option: Record<string, any>;
  };
  tag: Record<string, any>[];
  gsb: {
    lookup: Record<string, any>;
  };
  group: string[];
  last: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const websiteSchema: Schema<IWebsite> = new Schema(
  {
    url: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    track: {
      period: { type: Number, default: 0 },
      counter: { type: Number, default: 0 },
      option: {
        type: Object,
      },
    },
    tag: {
      type: [Object],
    },
    gsb: {
      lookup: {
        type: Object,
      },
    },
    group: [String],
    last: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  },
  { timestamps: true },
);

websiteSchema.index({ updatedAt: -1 });
//websiteSchema.index({url:1});

websiteSchema.plugin(mongoosePaginate);

const WebsiteModel: Model<IWebsite> = mongoose.model<IWebsite, mongoose.PaginateModel<IWebsite>>('Website', websiteSchema);

export default WebsiteModel;