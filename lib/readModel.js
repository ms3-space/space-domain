"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const space_config_1 = require("@ms3/space-config");
const domain_1 = require("./domain");
let viewModel = require('viewmodel');
function createReadModel(name, allowClear) {
    let repoFactory = viewModel.read;
    if (allowClear)
        repoFactory = viewModel.write;
    let repo = repoFactory(domain_1.getOptions().readModelStore, function (err) {
        if (err) {
            console.log('ohhh :-(');
            return;
        }
    }).extend({
        collectionName: space_config_1.config.get('tablePrefix') + name,
        findAsync: function () {
            return new Promise((resolve, reject) => {
                let key = domain_1.getPartitionKey();
                this.find({ PartitionKey: key }, (err, result) => {
                    if (err)
                        return reject(err);
                    if (result)
                        resolve(result.toJSON());
                    else
                        resolve([]);
                });
            });
        },
        findByIdAsync: function (id) {
            return new Promise((resolve, reject) => {
                let key = domain_1.getPartitionKey();
                this.findOne({ PartitionKey: key, RowKey: id }, (err, result) => {
                    if (err)
                        return reject(err);
                    if (result)
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
exports.createReadModel = createReadModel;
//# sourceMappingURL=readModel.js.map