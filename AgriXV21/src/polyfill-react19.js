// src/polyfill-react19.js
if (typeof document !== 'undefined') {
  try {
    const ReactDOM = require('react-dom');
    const ReactDOMClient = require('react-dom/client');
    
    // Polyfill render
    if (!ReactDOM.render) {
      ReactDOM.render = (element, container) => {
        const root = ReactDOMClient.createRoot(container);
        root.render(element);
        return root;
      };
    }
    
    // Polyfill hydrate
    if (!ReactDOM.hydrate) {
      ReactDOM.hydrate = (element, container) => {
        const root = ReactDOMClient.hydrateRoot(container, element);
        return root;
      };
    }

    // Polyfill unstable_batchedUpdates (no-op in React 18+)
    if (!ReactDOM.unstable_batchedUpdates) {
       ReactDOM.unstable_batchedUpdates = (cb) => { cb(); };
    }

    // Polyfill unmountComponentAtNode
    if (!ReactDOM.unmountComponentAtNode) {
      ReactDOM.unmountComponentAtNode = (container) => {
        if (container && container._reactRoot) {
          container._reactRoot.unmount();
          delete container._reactRoot;
          return true;
        }
        return false;
      };
    }

    // Polyfill findDOMNode (deprecated but used by some libs)
    if (!ReactDOM.findDOMNode) {
       ReactDOM.findDOMNode = (component) => {
         if (component instanceof Element) return component;
         if (component && component.current instanceof Element) return component.current;
         return component && component.nodeType ? component : null;
       };
    }
    
    console.log('AgriX: React 19 Web Polyfills applied successfully');
  } catch (e) {
    console.error('AgriX: Failed to apply React 19 polyfills', e);
  }
}
