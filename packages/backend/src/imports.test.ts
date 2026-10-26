import { forbiddenImports } from '../test/check-imports';

it('keeps platform-specific imports out of the injected adapter', async () => {
  expect(await forbiddenImports()).toEqual([]);
});
