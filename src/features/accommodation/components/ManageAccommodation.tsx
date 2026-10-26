import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { PrimaryButton, SqPanel, SqStatus, SqTable } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import {
  useDeleteAccommodationBlockMutation,
  useDeleteAccommodationCategoryMutation,
  useDeleteResidenceMutation,
  useGetAccommodationBlocksQuery,
  useGetResidenceOptionsQuery,
  useGetResidencesQuery,
  useSaveAccommodationBlockMutation,
  useSaveAccommodationCategoryMutation,
  useSaveResidenceMutation,
  useUploadBlockImageMutation,
  useUploadResidenceImageMutation,
  type AccommodationBlock,
  type AccommodationCategory,
  type Residence,
} from "../api";
import { blockFields, categoryFields, residenceFields, toPayload, valuesFrom } from "../accForms";
import { OCCUPANCY_STATUS } from "../accommodationHelpers";
import { AccFormModal } from "./AccFormModal";

type Editing =
  | { kind: "category"; record: AccommodationCategory | null }
  | { kind: "block"; record: AccommodationBlock | null }
  | { kind: "residence"; record: Residence | null }
  | null;

/** Small photo for a list row, or an icon when there's none. */
const Thumb = ({ src, icon }: { src?: string | null; icon: string }) => (
  <div className="w-10 h-10 shrink-0 rounded border border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001219] overflow-hidden flex items-center justify-center">
    {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Icon icon={icon} className="w-5 h-5 text-slate-400" />}
  </div>
);

const figures = (x: { residences_count: number; occupied_count: number; vacant_count: number }) =>
  `${x.residences_count} · ${x.occupied_count} occupied · ${x.vacant_count} vacant`;

/** "Manage" pill of the Accommodation tab: categories, blocks and residences. */
export const ManageAccommodation = ({ categories }: { categories: AccommodationCategory[] }) => {
  const dispatch = useAppDispatch();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const [editing, setEditing] = useState<Editing>(null);
  const [blockCategory, setBlockCategory] = useState("");
  const [residenceBlock, setResidenceBlock] = useState("");
  const [residenceCategory, setResidenceCategory] = useState("");

  const { data: blocks = [], isLoading: loadingBlocks } = useGetAccommodationBlocksQuery();
  const { data: residences = [], isLoading: loadingResidences } = useGetResidencesQuery({
    accommodation_category_id: residenceCategory || undefined,
    accommodation_block_id: residenceBlock || undefined,
  });
  const { data: options } = useGetResidenceOptionsQuery();
  const [saveCategory] = useSaveAccommodationCategoryMutation();
  const [deleteCategory] = useDeleteAccommodationCategoryMutation();
  const [saveBlock] = useSaveAccommodationBlockMutation();
  const [deleteBlock] = useDeleteAccommodationBlockMutation();
  const [saveResidence] = useSaveResidenceMutation();
  const [uploadBlockImage] = useUploadBlockImageMutation();
  const [uploadResidenceImage] = useUploadResidenceImageMutation();
  const [deleteResidence] = useDeleteResidenceMutation();

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const blockOptions = blocks.map((b) => ({ value: b.id, label: b.name, description: b.category?.name }));
  const typeOptions = options?.apartment_types ?? [];
  const shownBlocks = blockCategory ? blocks.filter((b) => String(b.accommodation_category_id) === blockCategory) : blocks;
  const toast = (message: string) => dispatch(showToast({ type: "success", message }));

  const modal = () => {
    if (!editing) return null;
    const close = () => setEditing(null);

    if (editing.kind === "category") {
      const { record } = editing;
      return (
        <AccFormModal
          title={record ? `Edit ${record.name}` : "Add category"}
          icon="mdi:shape-outline"
          fields={categoryFields}
          initial={valuesFrom(categoryFields, record, { sort_order: String(categories.length + 1) })}
          onSubmit={async (v) => {
            await saveCategory({ id: record?.id, data: toPayload(categoryFields, v) }).unwrap();
            toast(record ? "Category updated." : "Category added.");
          }}
          onDelete={record && has("accommodation-categories.delete") ? () => deleteCategory(record.id).unwrap().then(() => toast("Category deleted.")) : undefined}
          onClose={close}
        />
      );
    }

    if (editing.kind === "block") {
      const { record } = editing;
      const fields = blockFields(categoryOptions, async (file) => (await uploadBlockImage(file).unwrap()).data);
      return (
        <AccFormModal
          title={record ? `Edit ${record.name}` : "Add block"}
          icon="mdi:office-building-outline"
          fields={fields}
          initial={valuesFrom(fields, record, { accommodation_category_id: blockCategory })}
          onSubmit={async (v) => {
            await saveBlock({ id: record?.id, data: toPayload(fields, v) }).unwrap();
            toast(record ? "Block updated." : "Block added.");
          }}
          onDelete={record && has("accommodation-blocks.delete") ? () => deleteBlock(record.id).unwrap().then(() => toast("Block deleted.")) : undefined}
          onClose={close}
        />
      );
    }

    const { record } = editing;
    const fields = residenceFields(blockOptions, typeOptions, async (file) => (await uploadResidenceImage(file).unwrap()).data);
    return (
      <AccFormModal
        title={record ? `Edit ${record.name}` : "Add residence"}
        icon="mdi:home-plus-outline"
        fields={fields}
        initial={valuesFrom(fields, record, { capacity: "1", status: "available", accommodation_block_id: residenceBlock })}
        onSubmit={async (v) => {
          await saveResidence({ id: record?.id, data: toPayload(fields, v) }).unwrap();
          toast(record ? "Residence updated." : "Residence added.");
        }}
        onDelete={record && has("residences.delete") ? () => deleteResidence(record.id).unwrap().then(() => toast("Residence deleted.")) : undefined}
        onClose={close}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SqPanel
          title="Categories"
          subtitle="Each category is a tab above. Order sets their position."
          action={has("accommodation-categories.create") ? <PrimaryButton onClick={() => setEditing({ kind: "category", record: null })}>Add category</PrimaryButton> : undefined}
        >
          <SqTable<AccommodationCategory>
            rows={categories}
            rowKey={(c) => c.id}
            onRowClick={has("accommodation-categories.update") ? (c) => setEditing({ kind: "category", record: c }) : undefined}
            empty="No categories yet."
            columns={[
              { key: "name", label: "Category", render: (c) => <span className="font-semibold">{c.name}</span> },
              { key: "blocks", label: "Blocks", render: (c) => c.blocks_count },
              { key: "res", label: "Residences", render: (c) => figures(c) },
            ]}
          />
        </SqPanel>

        <SqPanel
          title="Blocks"
          subtitle="Groups of residences within a category, e.g. SOQ Block D."
          action={has("accommodation-blocks.create") ? <PrimaryButton onClick={() => setEditing({ kind: "block", record: null })}>Add block</PrimaryButton> : undefined}
        >
          <select value={blockCategory} onChange={(e) => setBlockCategory(e.target.value)} className={cn(fieldClass, "w-auto mb-3")}>
            <option value="">All categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <SqTable<AccommodationBlock>
            rows={shownBlocks}
            loading={loadingBlocks}
            rowKey={(b) => b.id}
            onRowClick={has("accommodation-blocks.update") ? (b) => setEditing({ kind: "block", record: b }) : undefined}
            empty="No blocks yet."
            columns={[
              {
                key: "name",
                label: "Block",
                render: (b) => (
                  <div className="flex items-center gap-2">
                    <Thumb src={b.image} icon="mdi:office-building-outline" />
                    <div>
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-[11px] opacity-70">{[b.category?.name, b.location].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                ),
              },
              { key: "res", label: "Residences", render: (b) => figures(b) },
            ]}
          />
        </SqPanel>
      </div>

      <SqPanel
        title="Residences"
        subtitle="Houses, flats and rooms. Occupied or vacant comes from the residents; set status only to take a residence out of use."
        action={has("residences.create") ? <PrimaryButton onClick={() => setEditing({ kind: "residence", record: null })}>Add residence</PrimaryButton> : undefined}
      >
        <div className="flex flex-wrap gap-3 mb-3">
          <select
            value={residenceCategory}
            onChange={(e) => {
              setResidenceCategory(e.target.value);
              setResidenceBlock("");
            }}
            className={cn(fieldClass, "w-auto")}
          >
            <option value="">All categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={residenceBlock} onChange={(e) => setResidenceBlock(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All blocks</option>
            {blocks
              .filter((b) => !residenceCategory || String(b.accommodation_category_id) === residenceCategory)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
        <SqTable<Residence>
          rows={residences}
          loading={loadingResidences}
          rowKey={(r) => r.id}
          onRowClick={has("residences.update") ? (r) => setEditing({ kind: "residence", record: r }) : undefined}
          empty="No residences yet."
          columns={[
            {
              key: "name",
              label: "Residence",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Thumb src={r.image} icon="mdi:home-outline" />
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[11px] opacity-70">{[r.block?.category?.name, r.block?.name].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              ),
            },
            { key: "type", label: "Type", render: (r) => r.apartment_type_label },
            { key: "rooms", label: "Rooms / baths", render: (r) => `${r.rooms ?? "–"} / ${r.bathrooms ?? "–"}` },
            { key: "floor", label: "Floor", render: (r) => r.floor ?? "–" },
            { key: "cap", label: "Occupancy", render: (r) => `${r.active_occupancies_count} / ${r.capacity}` },
            {
              key: "status",
              label: "Status",
              align: "right",
              render: (r) => <SqStatus value={OCCUPANCY_STATUS[r.occupancy_status].tone} label={OCCUPANCY_STATUS[r.occupancy_status].label} />,
            },
          ]}
        />
      </SqPanel>

      {modal()}
    </div>
  );
};
