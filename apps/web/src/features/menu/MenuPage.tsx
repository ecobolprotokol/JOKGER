import { useState } from 'react';
import type { FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useMenuManagementCatalog,
  useSetMenuItemAvailable,
  useUpsertCategory,
  useUpsertMenuItem,
  type MenuItem,
} from './index';
import { RecipeEditor } from './RecipeEditor';
import { PageHeader } from '../../shared/components/PageHeader';
import { Money } from '../../shared/components/Money';
import { strings } from '../../shared/strings/id';

const menuFormSchema = z.object({
  id: z.string().optional(),
  category_id: z.string().uuid(strings.menuManagement.categoryRequired),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(200),
  price: z.coerce.number().int().min(0).max(999_999_999),
  image_url: z.string(),
  is_available: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});

type MenuFormValues = z.infer<typeof menuFormSchema>;

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function MenuPage() {
  const catalog = useMenuManagementCatalog();
  const saveCategory = useUpsertCategory();
  const saveItem = useUpsertMenuItem();
  const setAvailable = useSetMenuItemAvailable();
  const [categoryName, setCategoryName] = useState('');
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [recipeItem, setRecipeItem] = useState<MenuItem | null>(null);
  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: {
      category_id: '',
      name: '',
      description: '',
      price: 0,
      image_url: '',
      is_available: true,
      is_active: true,
      sort_order: 0,
    },
  });

  if (catalog.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (catalog.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.menuManagement.loadError}</h1>
        <p>{getErrorMessage(catalog.error)}</p>
        <button className="button button--secondary" onClick={() => void catalog.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const { categories, items } = catalog.data;
  const visibleItems = selectedCategoryId
    ? items.filter((item) => item.category_id === selectedCategoryId)
    : items;

  function startNewItem(): void {
    setEditingItem(null);
    form.reset({
      category_id: selectedCategoryId ?? categories[0]?.id ?? '',
      name: '',
      description: '',
      price: 0,
      image_url: '',
      is_available: true,
      is_active: true,
      sort_order: 0,
    });
    saveItem.reset();
    setItemFormOpen(true);
  }

  function startEditItem(item: MenuItem): void {
    setEditingItem(item);
    form.reset({
      id: item.id,
      category_id: item.category_id,
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      image_url: item.image_url ?? '',
      is_available: item.is_available,
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    saveItem.reset();
    setItemFormOpen(true);
  }

  function submitCategory(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name || name.length > 80) return;
    saveCategory.mutate(
      { name, sort_order: categories.length },
      {
        onSuccess: () => {
          setCategoryName('');
          setCategoryFormOpen(false);
          toast.success(strings.menuManagement.savedCategory);
        },
      },
    );
  }

  function submitItem(values: MenuFormValues): void {
    const attachedGroups = editingItem?.modifierGroups.map((group) => group.id) ?? [];
    saveItem.mutate(
      {
        ...(values.id ? { id: values.id } : {}),
        category_id: values.category_id,
        name: values.name,
        description: values.description.trim() || null,
        price: values.price,
        image_url: values.image_url.trim() || null,
        is_available: values.is_available,
        is_active: values.is_active,
        sort_order: values.sort_order,
        modifier_group_ids: attachedGroups,
      },
      {
        onSuccess: () => {
          setItemFormOpen(false);
          toast.success(strings.menuManagement.savedItem);
        },
      },
    );
  }

  function toggleAvailable(item: MenuItem): void {
    setAvailable.mutate(
      { itemId: item.id, available: !item.is_available },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  }

  return (
    <main className="inventory-page menu-management-page">
      <PageHeader
        title={strings.menuManagement.title}
        actions={
          <div className="inventory-actions">
            <button
              className="button button--secondary"
              onClick={() => setCategoryFormOpen((open) => !open)}
            >
              {strings.menuManagement.addCategory}
            </button>
            <button
              className="button button--primary"
              disabled={categories.length === 0}
              onClick={startNewItem}
            >
              {strings.menuManagement.addItem}
            </button>
          </div>
        }
      />

      {categoryFormOpen && (
        <section className="menu-edit-panel" aria-labelledby="menu-category-form-title">
          <h2 id="menu-category-form-title">{strings.menuManagement.addCategory}</h2>
          <form className="menu-form-grid" onSubmit={submitCategory}>
            <label>
              <span>{strings.menuManagement.categoryName}</span>
              <input
                maxLength={80}
                required
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
            <div className="inventory-actions">
              <button className="button button--primary" disabled={saveCategory.isPending}>
                {strings.menuManagement.saveCategory}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setCategoryFormOpen(false)}
              >
                {strings.common.cancel}
              </button>
            </div>
          </form>
          {saveCategory.isError && <p role="alert">{getErrorMessage(saveCategory.error)}</p>}
        </section>
      )}

      {itemFormOpen && (
        <section className="menu-edit-panel" aria-labelledby="menu-item-form-title">
          <h2 id="menu-item-form-title">
            {editingItem ? strings.menuManagement.editItem : strings.menuManagement.addItem}
          </h2>
          <form className="menu-form-grid" onSubmit={form.handleSubmit(submitItem)}>
            <label>
              <span>{strings.menuManagement.category}</span>
              <select {...form.register('category_id')}>
                <option value="">{strings.menuManagement.categoryRequired}</option>
                {categories
                  .filter((category) => category.is_active)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
              {form.formState.errors.category_id && (
                <small role="alert">{form.formState.errors.category_id.message}</small>
              )}
            </label>
            <label>
              <span>{strings.menuManagement.itemName}</span>
              <input maxLength={80} {...form.register('name')} />
              {form.formState.errors.name && (
                <small role="alert">{strings.menuManagement.invalidName}</small>
              )}
            </label>
            <label>
              <span>{strings.menuManagement.description}</span>
              <textarea maxLength={200} rows={2} {...form.register('description')} />
            </label>
            <label>
              <span>{strings.menuManagement.price}</span>
              <input
                inputMode="numeric"
                type="number"
                min="0"
                step="1"
                {...form.register('price')}
              />
              {form.formState.errors.price && (
                <small role="alert">{strings.menuManagement.invalidPrice}</small>
              )}
            </label>
            <label>
              <span>{strings.menuManagement.imageUrl}</span>
              <input type="url" {...form.register('image_url')} />
            </label>
            <label>
              <span>{strings.menuManagement.sortOrder}</span>
              <input
                inputMode="numeric"
                type="number"
                min="0"
                step="1"
                {...form.register('sort_order')}
              />
            </label>
            <label className="menu-toggle-field">
              <input type="checkbox" {...form.register('is_available')} />
              <span>{strings.menuManagement.available}</span>
            </label>
            <label className="menu-toggle-field">
              <input type="checkbox" {...form.register('is_active')} />
              <span>{strings.menuManagement.active}</span>
            </label>
            <div className="inventory-actions menu-form-actions">
              <button className="button button--primary" disabled={saveItem.isPending}>
                {strings.menuManagement.saveItem}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setItemFormOpen(false)}
              >
                {strings.common.cancel}
              </button>
            </div>
          </form>
          {saveItem.isError && <p role="alert">{getErrorMessage(saveItem.error)}</p>}
        </section>
      )}

      {recipeItem && <RecipeEditor item={recipeItem} onClose={() => setRecipeItem(null)} />}

      {categories.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.menuManagement.noCategories}</h2>
        </section>
      ) : (
        <>
          <nav className="menu-category-tabs" aria-label={strings.menuManagement.categories}>
            <button
              className={!selectedCategoryId ? 'is-selected' : ''}
              aria-pressed={!selectedCategoryId}
              onClick={() => setSelectedCategoryId(null)}
            >
              {strings.menuManagement.items} ({items.length})
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={selectedCategoryId === category.id ? 'is-selected' : ''}
                aria-pressed={selectedCategoryId === category.id}
                onClick={() => setSelectedCategoryId(category.id)}
              >
                {category.name} ({items.filter((item) => item.category_id === category.id).length})
                {!category.is_active && ` · ${strings.menuManagement.inactive}`}
              </button>
            ))}
          </nav>
          {visibleItems.length === 0 ? (
            <section className="orders-empty" aria-live="polite">
              <h2>{strings.menuManagement.noItems}</h2>
              <button className="button button--primary" onClick={startNewItem}>
                {strings.menuManagement.addItem}
              </button>
            </section>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <caption className="visually-hidden">{strings.menuManagement.items}</caption>
                <thead>
                  <tr>
                    <th scope="col">{strings.menuManagement.itemName}</th>
                    <th scope="col">{strings.menuManagement.category}</th>
                    <th scope="col">{strings.menuManagement.price}</th>
                    <th scope="col">{strings.menuManagement.available}</th>
                    <th scope="col">{strings.menuManagement.active}</th>
                    <th scope="col">{strings.menuManagement.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <th scope="row">{item.name}</th>
                      <td>
                        {categories.find((category) => category.id === item.category_id)?.name}
                      </td>
                      <td>
                        <Money value={item.price} />
                      </td>
                      <td>
                        <button
                          className="button button--secondary"
                          disabled={setAvailable.isPending}
                          onClick={() => toggleAvailable(item)}
                        >
                          {item.is_available
                            ? strings.menuManagement.available
                            : strings.menuManagement.unavailable}
                        </button>
                      </td>
                      <td>
                        {item.is_active
                          ? strings.menuManagement.active
                          : strings.menuManagement.inactive}
                      </td>
                      <td>
                        <div className="inventory-actions">
                          <button
                            className="button button--ghost"
                            onClick={() => startEditItem(item)}
                          >
                            {strings.menuManagement.editItem}
                          </button>
                          <button
                            className="button button--secondary"
                            onClick={() => setRecipeItem(item)}
                          >
                            {strings.menuManagement.addRecipe}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
