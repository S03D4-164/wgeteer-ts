import mongoose, { Schema, Document, Model } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IHarfile extends Document {
  har: Buffer;
  webpage?: mongoose.Types.ObjectId;
}

const harfileSchema: Schema<IHarfile> = new Schema(
  {
    har: {
      type: Buffer,
      required: true,
    },
    webpage: { type: mongoose.Schema.Types.ObjectId, ref: 'Webpage' },
  },
  { timestamps: true },
);

harfileSchema.plugin(mongoosePaginate);

const HarfileModel: Model<IHarfile> = mongoose.model<
  IHarfile,
  mongoose.PaginateModel<IHarfile>
>('Harfile', harfileSchema);

export default HarfileModel;
