import { helloWorld } from '../helloWorld';

test('returns hello world', () => {
	expect(helloWorld()).toBe('hello world');
});