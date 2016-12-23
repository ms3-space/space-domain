import {config} from "@ms3/space-config";
import {getPartitionKey, getOptions} from "./domain";
let viewModel = require('viewmodel');

export function createReadModel(name:string, allowClear:boolean) {

  let repoFactory = viewModel.read;
  if(allowClear)
    repoFactory = viewModel.write;

  let repo = repoFactory(
    getOptions().readModelStore,
    function (err) {
      if (err) {
        console.log('ohhh :-(');
        return;
      }
    }).extend({
    collectionName: config.get('tablePrefix')  + name,
    findAsync: function():Promise<any> {
      return new Promise<any>((resolve, reject) => {

        let key = getPartitionKey();
        this.find({PartitionKey: key}, (err, result) => {
          if(err)
            return reject(err);
          if(result)
            resolve(result.toJSON());
          else
            resolve([]);
        });
      });
    },
    findByIdAsync: function(id):Promise<any> {
      return new Promise<any>((resolve, reject) => {
        let key = getPartitionKey();
        this.findOne({PartitionKey: key, RowKey: id}, (err, result) => {
          if(err)
            return reject(err);

          if(result)
            resolve(result.toJSON());
          else
            resolve(null);
        });
      });
    }
  });
  repo.connect();
  return repo;
}
