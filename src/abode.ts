import { type FC, createElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { getCurrentScript } from 'tiny-current-script';

interface RegisteredComponents {
  [key: string]: {
    module: Promise<any>;
    options?: { propParsers?: PropParsers };
  };
}

interface Props {
  [key: string]: any;
}

interface Options {
  propParsers?: PropParsers;
}
interface PropParsers {
  [key: string]: ParseFN;
}

interface HTMLElementAttributes {
  [key: string]: string;
}

interface PopulateOptions {
  attributes?: HTMLElementAttributes;
  callback?: () => void;
}

export type RegisterPromise = () => Promise<any>;
export type RegisterComponent = () => FC<any>;
export type RegisterFN = RegisterPromise | RegisterComponent;
export type ParseFN = (rawProp: string) => any;

export let componentSelector = 'data-component';
export let components: RegisteredComponents = {};
export let unPopulatedElements: Element[] = [];

export const register = (name: string, fn: RegisterFN, options?: Options) => {
  components[name] = { module: retry(fn, 10, 20), options };
};

export const unRegisterAllComponents = () => {
  components = {};
};

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const retry = async (
  fn: () => any,
  times: number,
  delayTime: number
): Promise<any> => {
  try {
    return await fn();
  } catch (err) {
    if (times > 1) {
      await delay(delayTime);
      return retry(fn, times - 1, delayTime * 2);
    } else {
      throw new Error(err as string);
    }
  }
};

export const setComponentSelector = (selector: string) => {
  componentSelector = selector;
};

export const getRegisteredComponents = () => {
  return components;
};

export const getActiveComponents = () => {
  return Array.from(
    new Set(getAbodeElements().map((el) => el.getAttribute(componentSelector)))
  );
};

// start prop logic
export const getCleanPropName = (raw: string): string => {
  return raw
    .replace('data-prop-', '')
    .replace(/-./g, (x) => x.toUpperCase()[1]);
};

/**
 * Resolves a nested path on the global window object
 * @param path - String path like "window.myGlobalFunction" or "window.App.services.logger"
 * @returns The resolved value or undefined if the path cannot be resolved
 */
const resolveGlobalReference = (path: string): unknown => {
  // Remove "window." prefix if present (for convenience)
  const cleanPath = path.startsWith('window.') ? path.slice(7) : path;
  
  // Split by dots and traverse the object
  const parts = cleanPath.split('.');
  let current: unknown = window;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    // Type guard: check if current is an object with index signature
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
    if (current === undefined) {
      return undefined;
    }
  }
  
  return current;
};

/**
 * Extracts and parses numeric props from data-n-prop-* attributes
 * @param el - The element to extract numeric props from
 * @returns Object with camelCase prop names and numeric values
 */
const getNumericProps = (el: Element): { [key: string]: number } => {
  const numericProps: { [key: string]: number } = {};
  const attributes = Array.from(el.attributes);
  
  for (const attr of attributes) {
    if (attr.name.startsWith('data-n-prop-')) {
      // Convert data-n-prop-* to data-prop-* format for getCleanPropName
      const propName = getCleanPropName(attr.name.replace('data-n-prop-', 'data-prop-'));
      numericProps[propName] = Number(attr.value);
    }
  }
  
  return numericProps;
};

/**
 * Extracts and resolves reference props from data-r-prop-* attributes
 * @param el - The element to extract reference props from
 * @returns Object with camelCase prop names and resolved values
 */
const getReferenceProps = (el: Element): { [key: string]: unknown } => {
  const referenceProps: { [key: string]: unknown } = {};
  const attributes = Array.from(el.attributes);
  
  for (const attr of attributes) {
    if (attr.name.startsWith('data-r-prop-')) {
      // Convert data-r-prop-* to data-prop-* format for getCleanPropName
      const propName = getCleanPropName(attr.name.replace('data-r-prop-', 'data-prop-'));
      const resolved = resolveGlobalReference(attr.value);
      
      if (resolved === undefined || resolved === null) {
        console.warn(
          `react-abode: Failed to resolve global reference "${attr.value}" for prop "${propName}"`
        );
        referenceProps[propName] = undefined;
      } else {
        referenceProps[propName] = resolved;
      }
    }
  }
  
  return referenceProps;
};

export const getElementProps = (
  el: Element | HTMLScriptElement,
  options?: Options
): Props => {
  // Priority 1: Check for data-props first (highest priority)
  const dataPropsAttr = el.getAttribute('data-props');
  if (dataPropsAttr) {
    try {
      const parsedProps = JSON.parse(dataPropsAttr);
      if (typeof parsedProps === 'object' && parsedProps !== null && !Array.isArray(parsedProps)) {
        // data-props found and successfully parsed, return early (ignore all other props)
        return parsedProps;
      }
    } catch (e) {
      console.warn(`react-abode: Failed to parse data-props attribute: ${(e as Error).message}`);
      return {};
    }
  }

  const props: { [key: string]: any } = {};

  if (el?.attributes) {
    // Priority 2: Process data-n-prop-* attributes (numeric parsing)
    const numericProps = getNumericProps(el);
    Object.assign(props, numericProps);

    // Priority 3: Process data-r-prop-* attributes (global reference parsing)
    const referenceProps = getReferenceProps(el);
    Object.assign(props, referenceProps);

    // Priority 4: Process standard data-prop-* attributes (existing logic)
    const rawProps = Array.from(el.attributes).filter((attribute) =>
      attribute.name.startsWith('data-prop-')
    );
    for (const prop of rawProps) {
      const componentName = getComponentName(el) ?? '';
      const propName = getCleanPropName(prop.name);
      
      // Skip if already set by numeric or reference props (numeric/reference take precedence)
      if (Object.prototype.hasOwnProperty.call(props, propName)) {
        continue;
      }
      
      const propParser =
        options?.propParsers?.[propName] ??
        components[componentName]?.options?.propParsers?.[propName];
      if (propParser) {
        // custom parse function for prop
        props[propName] = propParser(prop.value);
      } else {
        // default json parsing
        if (/^0+\d+$/.test(prop.value)) {
          /*
          ie11 bug fix;
          in ie11 JSON.parse will parse a string with leading zeros followed
          by digits, e.g. '00012' will become 12, whereas in other browsers
          an exception will be thrown by JSON.parse
          */
          props[propName] = prop.value;
        } else {
          try {
            props[propName] = JSON.parse(prop.value);
          } catch (e) {
            props[propName] = prop.value;
          }
        }
      }
    }
  }

  return props;
};

export const getScriptProps = (options?: Options) => {
  const element = getCurrentScript();
  if (element === null) {
    throw new Error('Failed to get current script');
  }
  return getElementProps(element, options);
};
// end prop logic

// start element logic
export const getAbodeElements = (): Element[] => {
  return Array.from(document.querySelectorAll(`[${componentSelector}]`)).filter(
    (el) => {
      const component = el.getAttribute(componentSelector);

      // It should exist in registered components
      return component && components[component];
    }
  );
};

export const setUnpopulatedElements = () => {
  unPopulatedElements = getAbodeElements().filter(
    (el) => !el.getAttribute('react-abode-populated')
  );
};

export const setAttributes = (
  el: Element,
  attributes: HTMLElementAttributes
) => {
  for (const [k, v] of Object.entries(attributes)) {
    el.setAttribute(k, v);
  }
};

// end element logic

function getComponentName(el: Element) {
  return Array.from(el.attributes).find((at) => at.name === componentSelector)
    ?.value;
}

export const renderAbode = async (el: Element, root: Root) => {
  const props = getElementProps(el);

  const componentName = getComponentName(el);

  if (!componentName || componentName === '') {
    throw new Error(
      `not all react-abode elements have a value for  ${componentSelector}`
    );
  }

  const module = await components[componentName]?.module;
  if (!module) {
    throw new Error(`no component registered for ${componentName}`);
  }

  const element = module.default || module;

  root.render(createElement(element, props));
};

export const trackPropChanges = (el: Element, root: Root) => {
  if (MutationObserver) {
    const observer = new MutationObserver(() => {
      renderAbode(el, root);
    });
    observer.observe(el, { attributes: true });
  }
};

function unmountOnNodeRemoval(element: any, root: Root) {
  const observer = new MutationObserver(() => {
    function isDetached(el: any): any {
      if (el.parentNode === document) {
        return false;
      } else if (el.parentNode === null) {
        return true;
      } else {
        return isDetached(el.parentNode);
      }
    }

    if (isDetached(element)) {
      observer.disconnect();
      root.unmount();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
}

export const update = async (
  elements: Element[],
  options?: PopulateOptions
) => {
  // tag first, since adding components is a slow process and will cause components to get iterated multiple times
  for (const el of elements) {
    el.setAttribute('react-abode-populated', 'true');
  }

  // TODO: Move this to requestAnimationFrame inside one loop to optimize
  for (const el of elements) {
    const root = createRoot(el);
    if (options?.attributes) setAttributes(el, options.attributes);
    renderAbode(el, root);
    trackPropChanges(el, root);
    unmountOnNodeRemoval(el, root);
  }
};

const checkForAndHandleNewComponents = async (options?: PopulateOptions) => {
  setUnpopulatedElements();

  if (unPopulatedElements.length) {
    await update(unPopulatedElements, options);
    unPopulatedElements = [];
    if (options?.callback) options.callback();
  }
};

export const populate = async (options?: PopulateOptions) => {
  await checkForAndHandleNewComponents(options);

  const observer = new MutationObserver(async (mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        await checkForAndHandleNewComponents(options);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};
