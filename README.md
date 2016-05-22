# ember-data-save-relationships

Include this mixin in your serializers and it will save your `hasMany` and `belongsTo` relationships' records.

For example:

```
// app/serializers/artist.js

import JSONAPISerializer from 'ember-data/serializers/json-api';
import SaveRelationshipsMixin from 'ember-data-save-relationships';

export default JSONAPISerializer.extend(SaveRelationshipsMixin, {
  attrs: {
    albums: { serialize: true }
  }
});
```

More info: http://emberigniter.com/saving-relationships-hasmany-json-api/

## Installation

* `ember-data-save-relationships`

## Notes

 - A temporary ID (`__id__`) will be sent along with the relationship's data `attributes`. Your server API **must** return this attribute intact along with a proper `id` in its data:
 ```
 data: {
   id: "1"
   type: "artists",
   attributes: {
     name: "Radiohead",
     __id__: "3internal-model"
   }
 }
 ```
 - Calling `serialize: true` on cyclic dependencies will result in a stack overflow
 - At this point in time, if your server returns updated `attributes`, these will **not** be updated in the Ember Data store

## Issues

Please file at https://github.com/frank06/ember-data-save-relationships/issues