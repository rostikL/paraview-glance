import macro from 'vtk.js/Sources/macro';
import vtkGeometryRepresentation from './GeometryRepresentation';
import vtkVolumeRepresentation from './VolumeRepresentation';
import vtkSliceRepresentation from './SliceRepresentation';

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

const PIPELINE_OBJECTS = {};

function registerObject(obj) {
  PIPELINE_OBJECTS[obj.getId()] = obj;
}

function unregisterObject(obj) {
  delete PIPELINE_OBJECTS[obj.getId()];
}

function createRepresentation(type) {
  switch (type) {
    case 'Volume':
      return vtkVolumeRepresentation.newInstance();
    case 'Geometry':
      return vtkGeometryRepresentation.newInstance();
    case 'Slice':
      return vtkSliceRepresentation.newInstance();
    case 'SliceZ':
      return vtkSliceRepresentation.newInstance({ slicingMode: 'Z' });
    case 'SliceY':
      return vtkSliceRepresentation.newInstance({ slicingMode: 'Y' });
    case 'SliceX':
      return vtkSliceRepresentation.newInstance({ slicingMode: 'X' });
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// vtkPipelineManager methods
// ----------------------------------------------------------------------------

function vtkPipelineManager(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPipelineManager');
  model.scene = {
    pipeline: {},
    views: {},
  };

  // Active API ---------------------------------------------------------------

  publicAPI.setActiveSourceId = (id) => {
    if (id !== model.activeSourceId) {
      model.activeSourceId = id;
      publicAPI.modified();
    }
  };

  publicAPI.setActiveViewId = (id) => {
    if (id !== model.activeViewId) {
      model.activeViewId = id;
      publicAPI.modified();
    }
  };


  publicAPI.getActiveSource = () => model.scene.pipeline[model.activeSourceId];

  publicAPI.getActiveView = () => model.scene.views[model.activeViewId];

  // Source API ---------------------------------------------------------------

  publicAPI.addSource = (source) => {
    if (model.scene.pipeline[source.getId()]) {
      return source.getId();
    }

    // Register object globaly
    registerObject(source);

    const representations = {};
    model.scene.pipeline[source.getId()] = {
      source,
      representations,
    };

    return source.getId();
  };

  publicAPI.removeSource = (id) => {
    if (!model.scene.pipeline[id]) {
      return;
    }

    const { source, representations } = model.scene.pipeline[id];
    unregisterObject(source);

    // Remove representation from any available view
    const respresentationTypes = Object.keys(representations);
    const viewIds = Object.keys(model.scene.views);
    let count = respresentationTypes.length;
    while (count--) {
      const representation = representations[respresentationTypes[count]];
      unregisterObject(representation);

      let vCount = viewIds.length;
      while (vCount--) {
        const view = model.scene.views[viewIds[vCount]];
        view.removeRepresentation(representation);
      }
      representation.delete();
    }

    // Remove source
    delete model.scene.pipeline[id];
  };

  publicAPI.listSources = () => {
    const list = [];
    const ids = Object.keys(model.scene.pipeline);
    let count = ids.length;
    while (count--) {
      const id = ids[count];
      const source = model.scene.pipeline[id].source;
      const name = source.getName();
      const type = source.getType();
      const active = (model.activeSourceId === id);
      const view = model.scene.views[model.activeViewId];
      const visible = view.isVisible(id);
      list.push({ id, name, type, active, visible, parent: '0' });
    }
    return list;
  };

  publicAPI.addSourceToViews = (sourceId) => {
    const views = model.views;
    let count = views.length;
    while (count--) {
      const view = views[count];
      const representation = publicAPI.getRepresentation(sourceId, view);
      view.addRepresentation(representation);
      view.renderLater();
    }
  };

  publicAPI.addSourcesToView = (view) => {
    const ids = Object.keys(model.scene.pipeline);
    let count = ids.length;
    while (count--) {
      const sourceId = ids[count];
      const representation = publicAPI.getRepresentation(sourceId, view);
      view.addRepresentation(representation);
      view.renderLater();
    }
  };

  publicAPI.getNumberOfSources = () => Object.keys(model.scene.pipeline).length;

  // Representation API -------------------------------------------------------

  publicAPI.getRepresentation = (sourceId, view) => {
    if (!model.scene.pipeline[sourceId]) {
      return null;
    }

    const { source, representations } = model.scene.pipeline[sourceId];
    const representationType = view.getRepresentationType(source.getType());
    if (!representationType) {
      return null;
    }

    // Create representation type if does not exist
    if (!representations[representationType]) {
      const representation = createRepresentation(representationType);
      representation.setInput(source);
      representations[representationType] = representation;
      registerObject(representation);
    }

    return representations[representationType];
  };

  // View API -----------------------------------------------------------------

  publicAPI.registerView = (view) => {
    if (!view) {
      return;
    }

    model.scene.views[view.getId()] = view;
    registerObject(view);

    if (!publicAPI.getActiveView()) {
      model.activeViewId = view.getId();
      console.log('register and activate');
    } else {
      console.log('register but skip');
    }

    // Add representation to new view
    const sourceIds = Object.keys(model.scene.pipeline);
    let count = sourceIds.length;
    while (count--) {
      const sourceId = sourceIds[count];
      const representation = publicAPI.getRepresentation(sourceId, view);
      view.addRepresentation(representation);
    }
    view.renderLater();

    // Update view list
    model.views = publicAPI.listViews();
  };

  publicAPI.unregisterView = (view) => {
    if (!view) {
      return;
    }

    console.log('unregister', view.getId());

    // Remove representations from view
    const ids = Object.keys(model.scene.pipeline);
    let count = ids.length;
    while (count--) {
      const id = ids[count];
      const { representations } = model.scene.pipeline[id];
      const types = Object.keys(representations);
      let rCount = types.length;
      while (rCount--) {
        const type = types[rCount];
        view.removeRepresentation(representations[type]);
      }
    }

    // Remove view from list
    unregisterObject(view);
    delete model.scene.views[view.getId()];

    // Update view list
    model.views = publicAPI.listViews();
  };

  publicAPI.listViews = () => {
    const views = [];
    const ids = Object.keys(model.scene.views);
    let count = ids.length;
    while (count--) {
      views.push(model.scene.views[ids[count]]);
    }
    return views;
  };

  publicAPI.renderLaterViews = () => {
    let count = model.views.length;
    while (count--) {
      model.views[count].renderLater();
    }
  };

  publicAPI.resizeViews = () => {
    let count = model.views.length;
    while (count--) {
      model.views[count].resize();
    }
  };

  publicAPI.resetCameraViews = () => {
    let count = model.views.length;
    while (count--) {
      model.views[count].resetCamera();
    }
  };

  // --------------------------------------------------------------------------
  // UI Handling
  // --------------------------------------------------------------------------

  publicAPI.updateCollapseState = (name, isOpen, collapseType) => {
    console.log('toggle', name, isOpen, collapseType);
  };

  publicAPI.getSections = () => {
    const sections = [];
    const item = publicAPI.getActiveSource();
    if (!item) {
      return [];
    }
    const view = publicAPI.getActiveView();
    if (item.source) {
      sections.push(item.source.getPropertySection());
    }
    if (item.source && view) {
      const representation = publicAPI.getRepresentation(item.source.getId(), view);
      if (representation) {
        sections.push(representation.getPropertySection());
      }
    }
    if (view) {
      sections.push(view.getPropertySection());
    }
    return sections;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['scene', 'activeViewId', 'activeSourceId']);

  // Object specific methods
  vtkPipelineManager(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkPipelineManager');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
