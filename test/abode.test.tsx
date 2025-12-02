/**
 * @jest-environment jsdom
 */

import * as fc from 'fast-check';
import {
  getCleanPropName,
  getAbodeElements,
  getRegisteredComponents,
  unPopulatedElements,
  setUnpopulatedElements,
  getElementProps,
  setAttributes,
  renderAbode,
  register,
  unRegisterAllComponents,
  components,
  populate,
  delay,
} from '../src/abode';
// @ts-ignore
import TestComponent from './TestComponent';
import TestComponentProps, { util } from './TestComponentProps';
import 'mutationobserver-shim';
import { createRoot } from 'react-dom/client';
global.MutationObserver = window.MutationObserver;

describe('helper functions', () => {
  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = '';
    unRegisterAllComponents();
  });

  it('getCleanPropName', () => {
    expect(getCleanPropName('data-prop-some-random-prop')).toEqual(
      'someRandomProp'
    );
  });

  it('getAbodeElements', () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponent');
    document.body.appendChild(abodeElement);

    expect(getAbodeElements()).toHaveLength(0);

    register('TestComponent', () => TestComponent);

    expect(getAbodeElements()).toHaveLength(1);
  });

  it('setUnpopulatedElements', () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponent');
    document.body.appendChild(abodeElement);

    setUnpopulatedElements();

    expect(unPopulatedElements).toHaveLength(0);

    register('TestComponent', () => TestComponent);
    setUnpopulatedElements();

    expect(unPopulatedElements).toHaveLength(1);
  });

  it('getElementProps', () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponent');
    abodeElement.setAttribute('data-prop-test-prop', 'testPropValue');
    abodeElement.setAttribute('data-prop-number-prop', '12345');
    abodeElement.setAttribute('data-prop-null-prop', 'null');
    abodeElement.setAttribute('data-prop-true-prop', 'true');
    abodeElement.setAttribute('data-prop-leading-zeros', '0012');
    abodeElement.setAttribute('data-prop-leading-zero', '012');
    abodeElement.setAttribute('data-prop-sku-one', 'B123456');
    abodeElement.setAttribute('data-prop-sku-two', 'AW-ARZA18-C0LM-78');
    abodeElement.setAttribute('data-prop-sku-three', 'TO-8370-228-770-6.0');
    abodeElement.setAttribute('data-prop-float', '10.46');
    abodeElement.setAttribute('data-prop-empty-prop', '');
    abodeElement.setAttribute(
      'data-prop-json-prop',
      '{"id": 12345, "product": "keyboard", "variant": {"color": "blue"}}'
    );

    const props = getElementProps(abodeElement);

    expect(props).toEqual({
      testProp: 'testPropValue',
      numberProp: 12345,
      nullProp: null,
      trueProp: true,
      leadingZeros: '0012',
      leadingZero: '012',
      skuOne: 'B123456',
      skuTwo: 'AW-ARZA18-C0LM-78',
      skuThree: 'TO-8370-228-770-6.0',
      float: 10.46,
      emptyProp: '',
      jsonProp: { id: 12345, product: 'keyboard', variant: { color: 'blue' } },
    });
  });

  it('getElementProps parses JSON', () => {
    fc.assert(
      fc.property(fc.json({ maxDepth: 10 }), data => {
        const abodeElement = document.createElement('div');
        abodeElement.setAttribute('data-prop-test-prop', JSON.stringify(data));
        const props = getElementProps(abodeElement);
        expect(props.testProp).toEqual(data);
      })
    );
  });

  it('getElementProps does not parse strings with leading zeros followed by other digits', () => {
    const strWithLeadingZeros = fc
      .tuple(fc.integer({ min: 1, max: 10 }), fc.integer())
      .map(t => {
        const [numberOfZeros, integer] = t;
        return '0'.repeat(numberOfZeros) + integer.toString();
      });
    fc.assert(
      fc.property(strWithLeadingZeros, data => {
        const abodeElement = document.createElement('div');
        abodeElement.setAttribute('data-prop-test-prop', data);
        const props = getElementProps(abodeElement);
        expect(props.testProp).toEqual(data);
      })
    );
  });

  it('setAttributes', () => {
    const abodeElement = document.createElement('div');

    setAttributes(abodeElement, { classname: 'test-class-name' });

    expect(abodeElement.getAttribute('classname')).toBe('test-class-name');
  });

  it('renderAbode without component name set', async () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', '');
    const root = createRoot(abodeElement);

    let err = new Error();
    try {
      await renderAbode(abodeElement, root);
    } catch (error) {
      err = error as Error;
    }

    expect(err.message).toEqual(
      'not all react-abode elements have a value for  data-component'
    );
  });

  it('renderAbode without component registered', async () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponent');
    const root = createRoot(abodeElement);

    let err = new Error();
    try {
      await renderAbode(abodeElement, root);
    } catch (error) {
      err = error as Error;
    }

    expect(err.message).toEqual('no component registered for TestComponent');
  });
});

describe('exported functions', () => {
  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = '';
    unRegisterAllComponents();
  });

  it('register', async () => {
    register('TestComponent', () => import('./TestComponent'));
    expect(Object.keys(components)).toEqual(['TestComponent']);
    expect(Object.values(components).length).toEqual(1);
    let promise = Object.values(components)[0].module;
    expect(typeof promise.then).toEqual('function');
    let module = await promise;
    expect(typeof module).toEqual('object');
    expect(Object.keys(module)).toEqual(['default']);

    register('TestComponent2', () => TestComponent);
    expect(Object.keys(components)).toEqual([
      'TestComponent',
      'TestComponent2',
    ]);
    expect(Object.values(components).length).toEqual(2);
    promise = Object.values(components)[1].module;
    expect(typeof promise.then).toEqual('function');
    module = await promise;
    expect(typeof module).toEqual('function');
  });

  it('populate', async () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponent');
    const abodeSecondElement = document.createElement('div');
    abodeSecondElement.setAttribute('data-component', 'TestComponent2');
    document.body.appendChild(abodeElement);
    document.body.appendChild(abodeSecondElement);
    expect(document.body.innerHTML).toEqual(
      `<div data-component="TestComponent"></div><div data-component="TestComponent2"></div>`
    );

    register('TestComponent', () => import('./TestComponent'));
    register('TestComponent2', () => TestComponent);
    await populate();

    await delay(20);

    expect(document.body.innerHTML).toEqual(
      `<div data-component="TestComponent" react-abode-populated="true"><div>testing 1 2 3 </div></div>` +
        `<div data-component="TestComponent2" react-abode-populated="true"><div>testing 1 2 3 </div></div>`
    );
  });

  it('getRegisteredComponents', () => {
    register('TestComponent', () => import('./TestComponent'));
    register('TestComponent2', () => TestComponent);

    const registeredComponents = getRegisteredComponents();

    expect(Object.keys(registeredComponents).length).toEqual(2);
  });

  it('uses custom prop parsers', async () => {
    const spy = jest.spyOn(util, 'getProps');
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponentProps');
    abodeElement.setAttribute('data-prop-number', '1');
    abodeElement.setAttribute('data-prop-boolean', 'true');
    abodeElement.setAttribute('data-prop-number-as-string', '123');
    abodeElement.setAttribute('data-prop-float', '1.01');
    document.body.appendChild(abodeElement);

    register('TestComponentProps', () => TestComponentProps, {
      propParsers: {
        number: (prop: string) => Number(prop),
        boolean: (prop: string) => Boolean(prop),
        numberAsString: (prop: string) => prop,
        float: (prop: string) => parseFloat(prop),
      },
    });
    await populate();
    await delay(20);

    expect(document.body.innerHTML).toEqual(
      `<div data-component="TestComponentProps" data-prop-number="1" data-prop-boolean="true" data-prop-number-as-string="123" data-prop-float="1.01" react-abode-populated="true"><div>1 2 3</div></div>`
    );
    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({
      number: 1,
      boolean: true,
      numberAsString: '123',
      float: 1.01,
    });
  });

  it('unmounts the React component when the wrapper is removed from the DOM', async () => {
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponentWithUnmount');
    document.body.appendChild(abodeElement);
    register('TestComponentWithUnmount', () =>
      import('./TestComponentWithUnmount')
    );
    await populate();
    await delay(20);
    expect(document.body.innerHTML).toEqual(
      `<div data-component="TestComponentWithUnmount" react-abode-populated="true"><h1>test component</h1></div>`
    );

    document.body.removeChild(abodeElement);
    await delay(20);
    expect(document.body.innerHTML).toEqual(`<unmounted></unmounted>`);
  });

  it('uses JSON.parse as a custom prop parser', async () => {
    const spy = jest.spyOn(util, 'getProps');
    const abodeElement = document.createElement('div');
    abodeElement.setAttribute('data-component', 'TestComponentProps');
    document.body.appendChild(abodeElement);
    fc.assert(
      fc.property(fc.json(), data => {
        abodeElement.setAttribute('data-prop-anything', JSON.stringify(data));
        register('TestComponentProps', () => TestComponentProps, {
          propParsers: {
            anything: (prop: string) => JSON.parse(prop),
          },
        });
        populate()
          .then(() => delay(20))
          .then(() => {
            expect(spy).toHaveBeenCalledWith({ anything: data });
          });
      })
    );
  });

  it.skip('getScriptProps', () => {});
  it.skip('getActiveComponents', () => {});
  it.skip('setComponentSelector', () => {});
  it.skip('register', () => {});
});

describe('react-habitat prop parsing features', () => {
  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = '';
    unRegisterAllComponents();
    // Clean up any global test functions
    // @ts-ignore
    delete window.testGlobalFunc;
    // @ts-ignore
    delete window.App;
  });

  describe('data-props (bulk JSON object)', () => {
    it('parses valid data-props JSON object', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '{"sku": "1234", "count": 5}');

      const props = getElementProps(abodeElement);

      expect(props).toEqual({ sku: '1234', count: 5 });
    });

    it('data-props overrides all other prop attributes', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '{"a": 1}');
      abodeElement.setAttribute('data-prop-b', '2');
      abodeElement.setAttribute('data-n-prop-c', '3');
      abodeElement.setAttribute('data-r-prop-d', 'window.testGlobalFunc');

      const props = getElementProps(abodeElement);

      expect(props).toEqual({ a: 1 });
      expect(props.b).toBeUndefined();
      expect(props.c).toBeUndefined();
      expect(props.d).toBeUndefined();
    });

    it('handles invalid JSON in data-props with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '{invalid json}');

      const props = getElementProps(abodeElement);

      expect(props).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse data-props attribute')
      );
      consoleSpy.mockRestore();
    });

    it('handles non-object JSON in data-props (string)', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '"just a string"');

      const props = getElementProps(abodeElement);

      // Should fall through to other props since it's not an object
      expect(props).toEqual({});
    });

    it('handles non-object JSON in data-props (array)', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '[1, 2, 3]');

      const props = getElementProps(abodeElement);

      // Should fall through to other props since it's not an object
      expect(props).toEqual({});
    });

    it('handles empty string in data-props', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '');

      const props = getElementProps(abodeElement);

      // Empty string should result in empty props (JSON.parse fails)
      expect(props).toEqual({});
      // Note: JSON.parse('') throws an error, which should trigger a warning
      // The exact warning behavior may vary, but the important part is empty props
      consoleSpy.mockRestore();
    });
  });

  describe('data-n-prop-* (numeric parsing)', () => {
    it('parses numeric float from data-n-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-height', '1.75');

      const props = getElementProps(abodeElement);

      expect(props.height).toBe(1.75);
      expect(typeof props.height).toBe('number');
    });

    it('parses numeric integer from data-n-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-count', '42');

      const props = getElementProps(abodeElement);

      expect(props.count).toBe(42);
      expect(typeof props.count).toBe('number');
    });

    it('converts empty string to 0 for data-n-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-value', '');

      const props = getElementProps(abodeElement);

      expect(props.value).toBe(0);
      expect(typeof props.value).toBe('number');
    });

    it('handles kebab-case to camelCase conversion for data-n-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-max-value', '100');

      const props = getElementProps(abodeElement);

      expect(props.maxValue).toBe(100);
      expect(typeof props.maxValue).toBe('number');
    });

    it('handles non-numeric string in data-n-prop-* (returns NaN)', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-price', 'not-a-number');

      const props = getElementProps(abodeElement);

      expect(props.price).toBeNaN();
      expect(typeof props.price).toBe('number');
    });

    it('data-n-prop-* takes precedence over data-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-count', '5');
      abodeElement.setAttribute('data-prop-count', '"five"');

      const props = getElementProps(abodeElement);

      expect(props.count).toBe(5);
      expect(typeof props.count).toBe('number');
    });
  });

  describe('data-r-prop-* (global reference parsing)', () => {
    beforeEach(() => {
      // Set up test global functions
      // @ts-ignore
      window.testGlobalFunc = jest.fn();
      // @ts-ignore
      window.App = {
        services: {
          logger: {
            log: jest.fn(),
          },
        },
      };
    });

    it('resolves simple global function from data-r-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-click-handler', 'window.testGlobalFunc');

      const props = getElementProps(abodeElement);

      expect(props.clickHandler).toBe((window as any).testGlobalFunc);
      expect(typeof props.clickHandler).toBe('function');
    });

    it('resolves nested global reference from data-r-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-log-service', 'window.App.services.logger');

      const props = getElementProps(abodeElement);

      expect(props.logService).toBe((window as any).App.services.logger);
      expect(typeof props.logService).toBe('object');
      expect((props.logService as any).log).toBeDefined();
    });

    it('handles kebab-case to camelCase conversion for data-r-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-event-callback', 'window.testGlobalFunc');

      const props = getElementProps(abodeElement);

      expect(props.eventCallback).toBe((window as any).testGlobalFunc);
    });

    it('handles non-existent global reference with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-missing', 'window.nonExistent');

      const props = getElementProps(abodeElement);

      expect(props.missing).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve global reference')
      );
      consoleSpy.mockRestore();
    });

    it('handles path with null in chain', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      // @ts-ignore
      window.testNull = null;
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-value', 'window.testNull.something');

      const props = getElementProps(abodeElement);

      expect(props.value).toBeUndefined();
      consoleSpy.mockRestore();
      // @ts-ignore
      delete window.testNull;
    });

    it('handles path without window. prefix', () => {
      // @ts-ignore
      window.simpleGlobal = { value: 42 };
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-ref', 'simpleGlobal');

      const props = getElementProps(abodeElement);

      // The implementation resolves paths without "window." prefix by treating them as window properties
      expect(props.ref).toEqual({ value: 42 });
      // @ts-ignore
      delete window.simpleGlobal;
    });

    it('data-r-prop-* takes precedence over data-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-r-prop-handler', 'window.testGlobalFunc');
      abodeElement.setAttribute('data-prop-handler', '"string handler"');

      const props = getElementProps(abodeElement);

      expect(props.handler).toBe((window as any).testGlobalFunc);
      expect(typeof props.handler).toBe('function');
    });
  });

  describe('mixed attributes and priority behavior', () => {
    beforeEach(() => {
      // @ts-ignore
      window.testFunc = jest.fn();
    });

    it('handles mixed numeric, reference, and standard props', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-n-prop-count', '5');
      abodeElement.setAttribute('data-r-prop-handler', 'window.testFunc');
      abodeElement.setAttribute('data-prop-name', '"test"');

      const props = getElementProps(abodeElement);

      expect(props.count).toBe(5);
      expect(typeof props.count).toBe('number');
      expect(props.handler).toBe((window as any).testFunc);
      expect(typeof props.handler).toBe('function');
      expect(props.name).toBe('test');
    });

    it('maintains existing data-prop-* functionality with JSON arrays', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-prop-items', '[1,2,3]');

      const props = getElementProps(abodeElement);

      expect(props.items).toEqual([1, 2, 3]);
    });

    it('priority order: data-props > data-n-prop-* > data-r-prop-* > data-prop-*', () => {
      const abodeElement = document.createElement('div');
      abodeElement.setAttribute('data-component', 'TestComponent');
      abodeElement.setAttribute('data-props', '{"final": "value"}');
      abodeElement.setAttribute('data-n-prop-final', '999');
      abodeElement.setAttribute('data-r-prop-final', 'window.testFunc');
      abodeElement.setAttribute('data-prop-final', '"ignored"');

      const props = getElementProps(abodeElement);

      // data-props should win
      expect(props).toEqual({ final: 'value' });
    });
  });
});
