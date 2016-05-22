# ember-data-save-relationships

Include this mixin in your serializers and it will save your `hasMany` and `belongsTo` relationships' records.

More info: http://emberigniter.com/saving-relationships-hasmany-json-api/

## Installation

* `ember-data-save-relationships`

## Bugs

  - fix stack overflow (ie can have both serialize: true without blowing up)