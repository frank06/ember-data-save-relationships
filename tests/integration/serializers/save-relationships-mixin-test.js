import Ember from 'ember';
import QUnit from 'qunit';
import { module, test } from 'qunit';
import DS from 'ember-data';
import SaveRelationshipsMixin from 'ember-data-save-relationships';

var registry, store, Artist, Album, Track, ContactPerson, SimpleModel, SimpleModelContainer;

QUnit.dump.maxDepth = 15;

module('serializers/save-relationships-mixin', {
  
  beforeEach() {
    
    registry = new Ember.Registry();

    const Owner = Ember.Object.extend(Ember._RegistryProxyMixin, Ember._ContainerProxyMixin);
    const owner = Owner.create({
      __registry__: registry
    });
    const container = registry.container({
      owner: owner
    });
    owner.__container__ = container;
    
    SimpleModel = DS.Model.extend({
    });
    
    SimpleModelContainer = DS.Model.extend({
      model: DS.belongsTo('simple-model'),
    });
    
    ContactPerson = DS.Model.extend({
      name: DS.attr()
    });
    
    Artist = DS.Model.extend({
      name: DS.attr(),
      contactPerson: DS.belongsTo(),
      albums: DS.hasMany('album')
    });
    
    Album = DS.Model.extend({
      name: DS.attr(),
      artist: DS.belongsTo('artist'),
      tracks: DS.hasMany('track')
    });

    Track = DS.Model.extend({
      name: DS.attr(),
      album: DS.belongsTo('album')
    });
    
    registry.register('model:contact-person', ContactPerson);
    registry.register('model:artist', Artist);
    registry.register('model:album', Album);
    registry.register('model:track', Track);
    registry.register('model:simple-model', SimpleModel);
    registry.register('model:simple-model-container', SimpleModelContainer);
    
    registry.register('service:store', DS.Store.extend({ adapter: '-default' }));
        
    store = container.lookup('service:store');
    
    registry.register('adapter:application', DS.JSONAPIAdapter);
    registry.register('serializer:application', DS.JSONAPISerializer);
    
  },
  
  afterEach() {
    Ember.run(store, 'destroy');
  }

});

test("serialize artist with embedded albums (with ID)", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: false }
    }
  }));

  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: false }
    }
  }));

  registry.register('serializer:track', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      album: { serialize: false }
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { name: "Kid B" });
    const album3 = store.createRecord('album', { name: "Kid C" });

    serializer.serialize(artist._createSnapshot());

    artist.get('albums').pushObjects([album1, album2, album3]);
  
    assert.equal(artist.get('albums.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

    const albumsJSON = { data: [
      { attributes: { name: 'Kid A', __id__: getInternalId(album1) },
        type: 'albums' },
      { attributes: { name: 'Kid B', __id__: getInternalId(album2) },
        type: 'albums' },
      { attributes: { name: 'Kid C', __id__: getInternalId(album3) },
      type: 'albums' } ]
    };
    
    assert.deepEqual(artistJSON, { data: {
        attributes: { name: 'Radiohead' },
        relationships: { albums: albumsJSON },
        type: 'artists'
      }
    });

  });
  
});

test("serialize artist with embedded album (with ID) with embedded tracks", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      tracks: { serialize: true},
      artist: { serialize: false}
    }
  }));

  registry.register('serializer:track', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      album: { serialize: false}
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  let artist, album1, track1, track2, track3;

  Ember.run(function() {
    
    artist = store.createRecord('artist', { name: "Radiohead" });
    album1 = store.createRecord('album', { name: "Kid A" });
    track1 = store.createRecord('track', { name: "Track 1"});
    track2 = store.createRecord('track', { name: "Track 2"});
    track3 = store.createRecord('track', { name: "Track 3"});

    artist.get('albums').pushObjects([album1]);
  
    assert.equal(artist.get('albums.length'), 1);

    album1.get('tracks').pushObjects([track1, track2, track3]);

    assert.equal(album1.get('tracks.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  

  const tracksJSON = { data: [
    { attributes: { name: 'Track 1', __id__: getInternalId(track1) },
      type: 'tracks' },
    { attributes: { name: 'Track 2', __id__: getInternalId(track2) },
      type: 'tracks' },
    { attributes: { name: 'Track 3', __id__: getInternalId(track3) },
      type: 'tracks' }
       ]
  };

  const albumsJSON = { data: [
    { attributes: { name: 'Kid A', __id__: getInternalId(album1) },
      relationships: { tracks: tracksJSON },
      type: 'albums' } ]
  };

  assert.deepEqual(artistJSON, { data: {
      attributes: { name: 'Radiohead' },
      relationships: { albums: albumsJSON },
      type: 'artists'
    }
  });

});

test("serialize model with no attributes", function(assert) {
  
  registry.register('serializer:simple-model-container', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      model: { serialize: true }
    }
  }));

  const serializer = store.serializerFor("simple-model-container");
  let model, container, simpleModelContainerJSON;
  
  Ember.run(function() {
    
    model = store.createRecord('simple-model');
    container = store.createRecord('simple-model-container');
    container.set('model', model);

    simpleModelContainerJSON = serializer.serialize(container._createSnapshot());

  });
  
  assert.deepEqual(simpleModelContainerJSON, { data: {
      relationships: { 
        model: {
          data: {
            type: 'simple-models',
            attributes: { __id__: getInternalId(model) }
          } 
        }
      },
      type: 'simple-model-containers'
    }
  });

});

test("serialize artist without embedded albums", function(assert) {

  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: false },
      contactPerson: { serialize: false }
    }
  }));

  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;

  Ember.run(function() {

    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { name: "Kid B" });
    const album3 = store.createRecord('album', { name: "Kid C" });

    artist.get('albums').pushObjects([album1, album2, album3]);

    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  assert.deepEqual(artistJSON, { data: {
      attributes: { name: 'Radiohead' }, type: 'artists'
    }
  });

});

test("serialize artist with embedded contact person and albums (with ID)", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: false }
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON, album1, album2, album3, contactPerson;
  
  Ember.run(function() {
    
    contactPerson = store.createRecord('contactPerson', { name: "Brian Message" });
    const artist = store.createRecord('artist', { name: "Radiohead", contactPerson });
    album1 = store.createRecord('album', { name: "Kid A" });
    album2 = store.createRecord('album', { name: "Kid B" });
    album3 = store.createRecord('album', { name: "Kid C" });

    artist.get('albums').pushObjects([album1, album2, album3]);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  const albumsJSON = { data: [
    { attributes: { name: 'Kid A', __id__: getInternalId(album1) },
      type: 'albums' },
    { attributes: { name: 'Kid B', __id__: getInternalId(album2) },
      type: 'albums' },
    { attributes: { name: 'Kid C', __id__: getInternalId(album3) },
    type: 'albums' } ]
  };
  
  const contactPersonJSON = { data:
    {
      type: "contact-people",
      attributes: {
        __id__: getInternalId(contactPerson),
        name: "Brian Message"
      }
    }
  };
  
  assert.deepEqual(artistJSON, { data: {
      attributes: { name: 'Radiohead' },
      relationships: {
        albums: albumsJSON,
        'contact-person': contactPersonJSON
      },
      type: 'artists'
    }
  });

});

test("serialize artist with embedded albums (with and without ID)", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { id: 1, name: "Kid A" });
    const album4 = store.createRecord('album', { name: "Kid D" });
    artist.get('albums').pushObjects([album1, album4]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  // __id__ should not be present in album with id
  assert.equal(artistJSON.data.relationships.albums.data[0].attributes.__id__, undefined);
  
  // __id__ should be present in album without id
  assert.ok(artistJSON.data.relationships.albums.data[1].attributes.__id__);

});

test("serialize album with embedded belongs-to artist (without ID)", function(assert) {
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: true }
    }
  }));
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("album");
  let albumJSON;
  
  Ember.run(function() {
    
    const album = store.createRecord('album', { name: "Kid A" });
    const artist = store.createRecord('artist', { name: "Radiohead" });
    album.set('artist', artist);
  
    albumJSON = serializer.serialize(album._createSnapshot());

  });
  
  assert.equal(albumJSON.data.relationships.artist.data.attributes.name, "Radiohead");

});

test("normalize artist + album", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const serverJSON = { data: 
     { id: "1",
       attributes: { name: 'Radiohead' },
       relationships: { albums: { data: 
     [ { id: "89329", attributes: { name: "Kid A", __id__: getInternalId(album1) }, type: 'album' },
       { id: "2", attributes: { name: "Kid B" }, type: 'albums' } ] } },
       type: 'artists' } };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

  });
  
  // first album should be in a saved state and have an id
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstAlbum.get('id'), "89329");
  
  const secondAlbum = store.peekAll('album').objectAt(1);
  assert.equal(secondAlbum.get('name'), "Kid B");

});

test("normalize artist + album when album is lazy loaded", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;

  let error = null;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const serverJSON = { 
      data: 
      { 
        id: "1",
        attributes: { name: 'Radiohead' },
        relationships: {
          albums: {
            "links": {
              "self": "http://example.com/artists/1/relationships/album"
            }
          }
        },
        type: 'artists'
      }
    };
    
    try
    {
      serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');
    }
    catch (e)
    {
      error = e;
    }
  });
  
  // should not have failed

  assert.equal(error, null);
});

test("normalize artist + album when data is included", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const serverJSON = { 
      data: 
      {
        id: "1",
        type: 'artists',
        attributes: { name: 'Radiohead' },
        relationships: { 
          albums: { 
            data: [ 
              { 
                id: "89329",
                type: 'album'
              },
              {
                id: "2",
                type: 'albums'
              }
            ]
          }
        }
      },
      included: [
        { 
          id: "89329",
          attributes: { name: "Kid A", __id__: getInternalId(album1) },
          type: 'album'
        },
        {
          id: "2",
          attributes: { name: "Kid B" },
          type: 'albums'
        }
      ]
    };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

    // first album should be in a saved state and have an id
    const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
    assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
    assert.equal(firstAlbum.get('id'), "89329");
    
    const secondAlbum = store.peekAll('album').objectAt(1);
    assert.equal(secondAlbum.get('name'), "Kid B");

  });
});

test("normalize artist + album when data is included does not duplicate models", function(assert) {
  
  const done = assert.async();

  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { id: "1", name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const serverJSON = { 
      data: 
      {
        id: "1",
        type: 'artists',
        attributes: { name: 'Radiohead' },
        relationships: { 
          albums: { 
            data: [ 
              { 
                id: "89329",
                type: 'album'
              },
              {
                id: "2",
                type: 'albums'
              }
            ]
          }
        }
      },
      included: [
        { 
          id: "89329",
          attributes: { name: "Kid A", __id__: getInternalId(album1) },
          type: 'album'
        },
        {
          id: "2",
          attributes: { name: "Kid B" },
          type: 'albums'
        }
      ]
    };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

    //should only have one album with id 89329
    const allAlbums = store.peekAll('album').toArray();
    assert.equal(allAlbums.length, 2, "should have two albums");
    const albums = allAlbums.filter(model => model.get("id") === "89329");
    assert.equal(albums.length, 1, "should only have one album with the server-side id");
    done();
  });
});

test("normalize artist + album when artist's albums relationship is lazy loaded but albums are included", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;

  let error = null;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const serverJSON = { 
      data: 
      { 
        id: "1",
        attributes: { name: 'Radiohead' },
        relationships: {
          albums: {
            "links": {
              "related": "http://example.com/artists/1/relationships/album"
            }
          }
        },
        "links": {
          "albums": "http://example.com/artists/1/relationships/album"
        },
        type: 'artists'
      },
      included: [
        { 
          id: "89329",
          attributes: { name: "Kid A", __id__: getInternalId(album1) },
          type: 'album'
        },
        {
          id: "2",
          attributes: { name: "Kid B" },
          type: 'albums'
        }
      ]
    };
    
    try
    {
      serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');
    }
    catch (e)
    {
      error = e;
    }

      // should not have failed

  assert.equal(error, null);

  // first album should be in a saved state and have an id
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstAlbum.get('id'), "89329");
  
  const secondAlbum = store.peekAll('album').objectAt(1);
  assert.equal(secondAlbum.get('name'), "Kid B");
  });
  

});

test("normalize artist with embedded album (with ID) with embedded tracks", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      tracks: { serialize: true},
      artist: { serialize: false}
    }
  }));

  registry.register('serializer:track', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      album: { serialize: false}
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  let artist, album1, track1, track2, track3;

  Ember.run(function() {
    
    artist = store.createRecord('artist', { name: "Radiohead" });
    album1 = store.createRecord('album', { name: "Kid A" });
    track1 = store.createRecord('track', { name: "Track 1"});
    track2 = store.createRecord('track', { name: "Track 2"});
    track3 = store.createRecord('track', { name: "Track 3"});

    artist.get('albums').pushObjects([album1]);
  
    assert.equal(artist.get('albums.length'), 1);

    album1.get('tracks').pushObjects([track1, track2, track3]);

    assert.equal(album1.get('tracks.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

    const serverJSON = 
    {
      data: 
      {
        id: "1",
        attributes: 
        {
          name: 'Radiohead'
        },
        relationships:
        { albums: { data: [ {
                id: "89329", 
                attributes: { name: "Kid A", __id__: getInternalId(album1) },
                type: 'album',
                relationships:
                { tracks: { data: [
                      {
                        id: "2",
                        attributes: { name: "Track 1", __id__: getInternalId(track1) },
                        type: "track"
                      },
                      { 
                        id: "3",
                        attributes: { name: "Track 2", __id__: getInternalId(track2) },
                        type: "track"
                      },
                      { 
                        id: "4",
                        attributes: { name: "Track 3", __id__: getInternalId(track3) },
                        type: "track"
                      }
                ] } }
        } ] } },

        type: 'artists'
      }
    };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

  });
  
  //Album
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstAlbum.get('id'), "89329");
  
  //Tracks
  const firstTrack = store.peekAll('track').findBy("name", "Track 1");
  assert.equal(firstTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstTrack.get('id'), "2");

  const secondTrack = store.peekAll('track').findBy("name", "Track 2");
  assert.equal(secondTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(secondTrack.get('id'), "3");

  const thirdTrack = store.peekAll('track').findBy("name", "Track 3");
  assert.equal(thirdTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(thirdTrack.get('id'), "4");

});

test("normalize artist with embedded album (with ID) with embedded tracks when data is included", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true },
      contactPerson: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      tracks: { serialize: true},
      artist: { serialize: false}
    }
  }));

  registry.register('serializer:track', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      album: { serialize: false}
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  let artist, album1, track1, track2, track3;

  Ember.run(function() {
    
    artist = store.createRecord('artist', { name: "Radiohead" });
    album1 = store.createRecord('album', { name: "Kid A" });
    track1 = store.createRecord('track', { name: "Track 1"});
    track2 = store.createRecord('track', { name: "Track 2"});
    track3 = store.createRecord('track', { name: "Track 3"});

    artist.get('albums').pushObjects([album1]);
  
    assert.equal(artist.get('albums.length'), 1);

    album1.get('tracks').pushObjects([track1, track2, track3]);

    assert.equal(album1.get('tracks.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

    const serverJSON = 
    {
      data: 
      {
        id: "1",
        type: 'artists',
        attributes: 
        {
          name: 'Radiohead'
        },
        relationships:
        { 
          albums: { 
            data: [ 
              {
                id: "89329", 
                type: 'album'
              }
            ]
          }
        }

      },
      included: [
        {
          id: "89329", 
          attributes: { name: "Kid A", __id__: getInternalId(album1) },
          type: 'album',
          relationships:
          { 
            tracks: { 
              data: [
                {
                  id: "2",
                  type: "track"
                },
                { 
                  id: "3",
                  type: "track"
                },
                { 
                  id: "4",
                  type: "track"
                }
              ]
            }
          }
        },
        {
          id: "2",
          attributes: { name: "Track 1", __id__: getInternalId(track1) },
          type: "track"
        },
        { 
          id: "3",
          attributes: { name: "Track 2", __id__: getInternalId(track2) },
          type: "track"
        },
        { 
          id: "4",
          attributes: { name: "Track 3", __id__: getInternalId(track3) },
          type: "track"
        }

      ]
    };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

  });
  
  //Album
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstAlbum.get('id'), "89329");
  
  //Tracks
  const firstTrack = store.peekAll('track').findBy("name", "Track 1");
  assert.equal(firstTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstTrack.get('id'), "2");

  const secondTrack = store.peekAll('track').findBy("name", "Track 2");
  assert.equal(secondTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(secondTrack.get('id'), "3");

  const thirdTrack = store.peekAll('track').findBy("name", "Track 3");
  assert.equal(thirdTrack.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(thirdTrack.get('id'), "4");

});

test("normalize album belongs-to artist", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: true }
    }
  }));

  const serializer = store.serializerFor("album");
  let albumJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album = store.createRecord('album', { name: "Kid A", artist });
  
    albumJSON = serializer.serialize(album._createSnapshot());
    
    const internalId = albumJSON.data.relationships.artist.data.attributes.__id__;
    
    const serverJSON = { data:
      {
        id: "1",
        type: 'albums',
        attributes: { name: "Kid A"},
        relationships: {
          artists: {
            data: {
              id: "1",
              type: "artists",
              attributes: {
                name: "Radiohead XXXX",
                __id__: internalId
              }
            }
          }
        }
      }
    };
    
    serializer.normalizeResponse(store, Album, serverJSON, '1', 'createRecord');

  });
  
  // should NOT update name
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('artist.name'), "Radiohead");

});

test("normalize album belongs-to artist when data is included", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: true }
    }
  }));

  const serializer = store.serializerFor("album");
  let albumJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album = store.createRecord('album', { name: "Kid A", artist });
  
    albumJSON = serializer.serialize(album._createSnapshot());
    
    const internalId = albumJSON.data.relationships.artist.data.attributes.__id__;
    
    const serverJSON = { data:
      {
        id: "1",
        type: 'albums',
        attributes: { name: "Kid A"},
        relationships: {
          artists: {
            data: {
              id: "1",
              type: "artists"
            }
          }
        }
      },

      included: [
        {
          id: "1",
          type: "artists",
          attributes: {
            name: "Radiohead XXXX",
            __id__: internalId
          }
        }
      ]
    };
    
    serializer.normalizeResponse(store, Album, serverJSON, '1', 'createRecord');

  });
  
  // should NOT update name
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('artist.name'), "Radiohead");

});


test("normalize album belongs-to artist when recursive data is included", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: false }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: true }
    }
  }));

  const serializer = store.serializerFor("album");
  let albumJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album = store.createRecord('album', { name: "Kid A", artist });
  
    albumJSON = serializer.serialize(album._createSnapshot());
    
    const internalId = albumJSON.data.relationships.artist.data.attributes.__id__;
    
    const serverJSON = { data:
      {
        id: "1",
        type: 'albums',
        attributes: { name: "Kid A"},
        relationships: {
          artists: {
            data: {
              id: "1",
              type: "artists"
            }
          }
        }
      },

      included: [
        {
          id: "1",
          type: "artists",
          attributes: {
            name: "Radiohead XXXX",
            __id__: internalId
          },
          relationships: {
            albums: {
              data: {
                id: "1",
                type: "albums"
              }
            }
          }
        }
      ]
    };
    
    serializer.normalizeResponse(store, Album, serverJSON, '1', 'createRecord');

  });
  
  // should NOT update name
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('artist.name'), "Radiohead");

});

function getInternalId(model) {
  return model.get('_internalModel')[Ember.GUID_KEY];
}