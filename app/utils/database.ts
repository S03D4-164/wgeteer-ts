import mongoose, { Connection } from 'mongoose';
import logger from './logger';

const mongoConnectionString = 'mongodb://127.0.0.1:27017/wgeteer';

const db: Connection = mongoose.createConnection(mongoConnectionString, {
  //useUnifiedTopology: true,
  //useNewUrlParser: true,
  //useCreateIndex: true,
  //useFindAndModify: false,
});

db.on('connected', () => {
  logger.debug('[mongoose] createConnection completed');
});

db.on('error', (err: Error) => {
  logger.error('[mongoose] createConnection error', err);
});

async function closeDB(db: Connection) {
  try {
    const modelNames = Object.keys(db.models);
    modelNames.forEach((modelName) => {
      //delete db.models[modelName];
      //logger.debug('deleted model ' + modelName);
    });

    const collectionNames = Object.keys(db.collections);
    collectionNames.forEach((collectionName) => {
      delete db.collections[collectionName];
      logger.debug('deleted collection ' + collectionName);
    });
    /*
    const modelSchemaNames = Object.keys(db.base.modelSchemas);
    modelSchemaNames.forEach((modelSchemaName) => {
      delete db.base.modelSchemas[modelSchemaName];
      logger.debug("deleted schema " + modelSchemaName);
    });
    */
  } catch (err) {
    logger.error(err);
  }
}

export { db, closeDB };
