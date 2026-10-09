import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useInventoryItems } from '../inventory';
import { useMenuRecipe, useUpsertRecipe, type MenuItem } from './index';
import { strings } from '../../shared/strings/id';

const recipeFormSchema = z.object({
  lines: z
    .array(
      z.object({
        inventory_item_id: z.string().uuid(),
        qty_per_serving: z.coerce.number().finite().positive().max(999_999_999.999),
      }),
    )
    .refine((lines) => new Set(lines.map((line) => line.inventory_item_id)).size === lines.length, {
      message: strings.menuManagement.duplicateIngredient,
    }),
});

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function RecipeEditor({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const recipe = useMenuRecipe(item.id);
  const inventory = useInventoryItems();
  const saveRecipe = useUpsertRecipe();
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: { lines: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  useEffect(() => {
    if (recipe.isSuccess && !form.formState.isDirty) {
      form.reset({ lines: recipe.data });
    }
  }, [form, recipe.data, recipe.isSuccess]);

  if (recipe.isPending || inventory.isPending) {
    return (
      <section className="menu-edit-panel" role="status">
        {strings.app.loading}
      </section>
    );
  }

  if (recipe.isError || inventory.isError) {
    return (
      <section className="menu-edit-panel" role="alert">
        <h2>
          {strings.menuManagement.recipeTitle}: {item.name}
        </h2>
        <p>{getErrorMessage(recipe.error ?? inventory.error)}</p>
        <button className="button button--secondary" onClick={onClose}>
          {strings.common.cancel}
        </button>
      </section>
    );
  }

  if (inventory.data.length === 0) {
    return (
      <section className="menu-edit-panel" aria-labelledby="recipe-empty-title">
        <h2 id="recipe-empty-title">
          {strings.menuManagement.recipeTitle}: {item.name}
        </h2>
        <p>{strings.menuManagement.inventoryUnavailable}</p>
        <div className="inventory-actions">
          <Link className="button button--primary" to="/inventory">
            {strings.menuManagement.inventoryLink}
          </Link>
          <button className="button button--ghost" onClick={onClose}>
            {strings.common.cancel}
          </button>
        </div>
      </section>
    );
  }

  function submitRecipe(values: RecipeFormValues): void {
    saveRecipe.mutate(
      { menuItemId: item.id, lines: values.lines },
      { onSuccess: () => toast.success(strings.menuManagement.savedRecipe) },
    );
  }

  return (
    <section className="menu-edit-panel" aria-labelledby="recipe-editor-title">
      <h2 id="recipe-editor-title">
        {strings.menuManagement.recipeTitle}: {item.name}
      </h2>
      {fields.length === 0 && <p>{strings.menuManagement.noIngredients}</p>}
      <form className="menu-form-grid" onSubmit={form.handleSubmit(submitRecipe)}>
        {fields.map((field, index) => (
          <div className="recipe-line" key={field.id}>
            <label>
              <span>{strings.menuManagement.ingredient}</span>
              <select {...form.register(`lines.${index}.inventory_item_id`)}>
                <option value="">{strings.menuManagement.ingredient}</option>
                {inventory.data.map((stockItem) => (
                  <option key={stockItem.id} value={stockItem.id}>
                    {stockItem.name} ({stockItem.unit})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{strings.menuManagement.quantityPerServing}</span>
              <input
                inputMode="decimal"
                type="number"
                min="0.001"
                max="999999999.999"
                step="0.001"
                {...form.register(`lines.${index}.qty_per_serving`)}
              />
            </label>
            <button className="button button--ghost" type="button" onClick={() => remove(index)}>
              {strings.menuManagement.removeIngredient}
            </button>
          </div>
        ))}
        {form.formState.errors.lines?.message && (
          <p className="menu-form-error" role="alert">
            {form.formState.errors.lines.message}
          </p>
        )}
        {saveRecipe.isError && (
          <p className="menu-form-error" role="alert">
            {getErrorMessage(saveRecipe.error)}
          </p>
        )}
        <div className="inventory-actions menu-form-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => append({ inventory_item_id: '', qty_per_serving: 1 })}
          >
            {strings.menuManagement.addIngredient}
          </button>
          <button className="button button--primary" disabled={saveRecipe.isPending}>
            {strings.menuManagement.saveRecipe}
          </button>
          <button className="button button--ghost" type="button" onClick={onClose}>
            {strings.common.cancel}
          </button>
        </div>
      </form>
    </section>
  );
}
