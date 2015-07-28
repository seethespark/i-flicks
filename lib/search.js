/// Error code: F13


function score(search, searchString) {
//console.log(search);
  return searchString.split(/\s/g).reduce(function (prev, curr) {
    if (search.target === undefined || search.target.length === 0) {
      return prev;
    }
    /// exact match
    if (search.target === curr) {
      return search.weight + prev;
    }
    /// case insensitive match is worth less
    if (search.target.toLowerCase() === curr.toLowerCase()) {
      return (0.8 * search.weight) + prev;
    }
    /// if word starts with the search string
    if (search.target.toLowerCase().indexOf(curr.toLowerCase()) === 0) {
      return (0.3 * search.weight) + prev;
    }
    /// if word contains with the search string
    if (search.target.toLowerCase().indexOf(curr.toLowerCase()) > 0) {
      return (0.1 * search.weight) + prev;
    }
    return prev;
  }, 0);

}

/** Main search entry point
 */
function search(dataset, fields, searchString) {
  var result = dataset.map(function (val) {
      /// Combine the dataset with the relevant weighting into one long array
      return fields.map(function (val2) {
        if (Array.isArray(val[val2.name])) { //tags
          return val[val2.name].map(function (val3) {
            return { id: val.id, target: val3, weight: val2.weight / 6 };
          });
        } else {
          return [{ id: val.id, target: val[val2.name], weight: val2.weight }];
        }
      }).reduce(function (prev, curr) {
        return prev.concat(curr);
      }, []);
    })
      .reduce(function (prev, curr) {
        return prev.concat(curr);
      }, [])
      .map(function (val) { // split by space
        if (/\s/g.test(val.target)) {
          return val.target.split(/\s/g).map(function (val2, i) {
            var weight = val.weight/i; //should be non lianear me thinks
            return { id: val.id, target: val2, weight: val.weight };
          });
        } else {
          return [{ id: val.id, target: val.target, weight: val.weight }];
        }
      })
      .reduce(function (prev, curr) {
        return prev.concat(curr);
        }, [])
      .map(function (val) {
        return { id: val.id, score: score(val, searchString) };
      })
      .sort(function (a, b) { ///
        if (a.id > b.id) {
          return 1;
        }
        if (a.id < b.id) {
          return -1;
        }
        // a must be equal to b
        return 0;
      })
      .reduce(function (prev, curr, i) {
        if (curr.score > 0 && prev.length > 0 && prev[prev.length-1].id === curr.id) {
          prev[prev.length-1].score += curr.score;
        } else if (curr.score > 0) {
          prev.push(curr);
        }
        return prev;
      }, [])
      .sort(function (a, b) {
        if (a.score > b.score) {
          return -1;
        }
        if (a.score < b.score) {
          return 1;
        }
        // a must be equal to b
        return 0;
      });
  //console.log(result);
  return result;
}

module.exports = search;