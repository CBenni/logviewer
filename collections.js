/*
Holds an indexed collection of objects
@param indexes A list of properties to be indexed. Omit to autoindex.
*/

function IndexedCollection(indexes) {
	let self = this;
	if(indexes && !indexes.length) throw "Bad value for indexes";
	self.indexes = indexes;
	self.index = {}; // self.index[prop][value] is an array containing all elements in this IndexedCollection that have the property `prop` set to `value`
	self.items = [];
	if(indexes) for(let i=0;i<indexes.length;++i) {
		self.index[indexes[i]] = new Map(); // each of the indexes has a map "value => item"
	}
}

/*
Adds an item to the IndexedCollection
@param item the object to be added
*/
const hasOwn = Object.prototype.hasOwnProperty;
IndexedCollection.prototype.add = function(item) {
	let self = this;
	if(self.indexes === undefined) {
		let props = Object.keys(item);
		for(let i=0;i<props.length;++i) {
			let prop = props[i];
			if(hasOwn.call(item, prop)) self.addToIndex(prop, item);
		}
		self.items.push(item);
	} else {
		for(let i=0;i<self.indexes.length;++i) {
			self.addToIndex(self.indexes[i], item);
		}
		self.items.push(item);
	}
}

IndexedCollection.prototype.addToIndex = function(prop, item) {
	let self = this;
	let val = item[prop];
	let index = self.index[prop];
	if(!index) index = self.index[prop] = new Map();
	if(index.get(val)) {
		index.get(val).push(item);
	} else {
		index.set(val, [item]);
	}
}

/*
Gets items from the IndexedCollection (Query by Example)
@complexity O(nlogn(#props)*log(#items)+#items*#props)
*/
IndexedCollection.prototype.QBE = function(qbe) {
	let self = this;
	if(!qbe) return self.items;
	let props = Object.keys(qbe);
	if(props.length == 0) return self.items;
	let res = [];
	let bestprop, bestlist, bestlength = Infinity;
	// find the best index to use - O(m)
	for(let i=0;i<props.length;++i) {
		let prop = props[i];
		if(hasOwn.call(qbe, prop)) {
			let val = qbe[prop];
			if(self.index[prop]) {
				let list = self.index[prop].get(val);
				if(list.length == 0) return [];
				else if(list && list.length < bestlength) {
					bestprop = i;
					bestlist = list;
					bestlength = list.length;
				}
			} else if(bestlist === undefined) {
				bestlist = self.items;
				bestlength = self.items.length;
			}
		}
	}
	if(props.length == 1) return bestlist;
	console.log("Best index: "+props[bestprop]);
	for(let j=0;j<bestlist.length;++j) {
		let item = bestlist[j];
		let ok = true;
		for(let i=0;i<props.length;++i) {
			if(i===bestprop) continue;
			let prop = props[i];
			if(hasOwn.call(qbe, prop)) {
				let val = qbe[prop];
				if(val !== item[prop]) {
					ok = false;
					break;
				}
			}
		}
		if(ok) res.push(item);
	}
	return res;
}


IndexedCollection.prototype.get = function(prop, val) {
	let self = this;
	if(self.index[prop]) {
		return self.index[prop].get(val);
	} else {
		var res = [];
		for(let i=0;i<self.items.length;++i) {
			let item = self.items[i];
			if(item[prop] === val) {
				res.push(item);
			}
		}
		return res;
	}
}


module.export = IndexedCollection;