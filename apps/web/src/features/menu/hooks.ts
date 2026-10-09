import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  readMenuCatalog,
  readMenuManagementCatalog,
  readMenuRecipe,
  setMenuItemAvailable,
  upsertCategory,
  upsertMenuItem,
  upsertRecipe,
} from './api';
import type { MenuCategoryInput, MenuItemInput, RecipeInput } from './api';
import type { Result } from '../../shared/lib/errors';

async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) {
    throw result.error;
  }
  return result.data;
}

export function useMenuCatalog() {
  return useQuery({
    queryKey: ['menu', 'catalog'],
    queryFn: async () => {
      const result = await readMenuCatalog();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}

export function useMenuManagementCatalog() {
  return useQuery({
    queryKey: ['menu', 'management'],
    queryFn: async () => {
      const result = await readMenuManagementCatalog();
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
  });
}

export function useMenuRecipe(menuItemId: string | null) {
  return useQuery({
    queryKey: ['menu', 'recipe', menuItemId],
    enabled: menuItemId !== null,
    queryFn: async () => {
      if (!menuItemId) {
        throw new Error('Menu resep belum dipilih.');
      }
      return unwrap(readMenuRecipe(menuItemId));
    },
  });
}

function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['menu'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] }),
    ]);
  };
}

export function useUpsertCategory() {
  const invalidateMenu = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: MenuCategoryInput) => unwrap(upsertCategory(input)),
    onSuccess: invalidateMenu,
  });
}

export function useUpsertMenuItem() {
  const invalidateMenu = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: MenuItemInput) => unwrap(upsertMenuItem(input)),
    onSuccess: invalidateMenu,
  });
}

export function useSetMenuItemAvailable() {
  const invalidateMenu = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ itemId, available }: { itemId: string; available: boolean }) =>
      unwrap(setMenuItemAvailable(itemId, available)),
    onSuccess: invalidateMenu,
  });
}

export function useUpsertRecipe() {
  const invalidateMenu = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: RecipeInput) => unwrap(upsertRecipe(input)),
    onSuccess: invalidateMenu,
  });
}
