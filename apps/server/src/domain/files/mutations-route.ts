import { Elysia } from 'elysia';
import { filesMutationsCoreRoute } from './mutations-core';
import { filesMutationsLifecycleRoute } from './mutations-lifecycle';
import { filesMutationsSettingsRoute } from './mutations-settings';

export const filesMutationsRoute = new Elysia()
  .use(filesMutationsCoreRoute)
  .use(filesMutationsLifecycleRoute)
  .use(filesMutationsSettingsRoute);
