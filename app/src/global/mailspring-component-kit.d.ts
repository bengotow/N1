declare module "mailspring-component-kit" {
export const Menu: typeof import('../components/menu').default;
export const DropZone: typeof import('../components/drop-zone').default;
export const Spinner: typeof import('../components/spinner').default;
export const Switch: typeof import('../components/switch').default;
export const FixedPopover: typeof import('../components/fixed-popover').default;
export const DatePickerPopover: typeof import('../components/date-picker-popover').default;
export const Modal: typeof import('../components/modal').default;
export const Webview: typeof import('../components/webview').default;
export const FeatureUsedUpModal: typeof import('../components/feature-used-up-modal').default;
export const BillingModal: typeof import('../components/billing-modal').default;
export const OpenIdentityPageButton: typeof import('../components/open-identity-page-button').default;
export const Flexbox: typeof import('../components/flexbox').default;
export const RetinaImg: typeof import('../components/retina-img').default;
export const SwipeContainer: typeof import('../components/swipe-container').default;
export const FluxContainer: typeof import('../components/flux-container').default;
export const FocusContainer: typeof import('../components/focus-container').default;
export const SyncingListState: typeof import('../components/syncing-list-state').default;
export const EmptyListState: typeof import('../components/empty-list-state').default;
export const ListTabular: typeof import('../components/list-tabular').default;
export const Notification: typeof import('../components/notification').default;
export const EventedIFrame: typeof import('../components/evented-iframe').default;
export const ButtonDropdown: typeof import('../components/button-dropdown').default;
export const MultiselectList: typeof import('../components/multiselect-list').default;
export const BoldedSearchResult: typeof import('../components/bolded-search-result').default;
export const MultiselectDropdown: typeof import('../components/multiselect-dropdown').default;
export const KeyCommandsRegion: typeof import('../components/key-commands-region').default;
export const BindGlobalCommands: typeof import('../components/bind-global-commands').default;
export const TabGroupRegion: typeof import('../components/tab-group-region').default;
export const InjectedComponent: typeof import('../components/injected-component').default;
export const TokenizingTextField: typeof import('../components/tokenizing-text-field').default;
export const ParticipantsTextField: typeof import('../components/participants-text-field').default;
export const MultiselectToolbar: typeof import('../components/multiselect-toolbar').default;
export const InjectedComponentSet: typeof import('../components/injected-component-set').default;
export const MetadataComposerToggleButton: typeof import('../components/metadata-composer-toggle-button').default;
export const ConfigPropContainer: typeof import('../components/config-prop-container').default;
export const DisclosureTriangle: typeof import('../components/disclosure-triangle').default;
export const EditableList: typeof import('../components/editable-list').default;
export const DropdownMenu: typeof import('../components/dropdown-menu').default;
export const OutlineViewItem: typeof import('../components/outline-view-item').default;
export const OutlineView: typeof import('../components/outline-view').default;
export const DateInput: typeof import('../components/date-input').default;
export const DatePicker: typeof import('../components/date-picker').default;
export const TimePicker: typeof import('../components/time-picker').default;
export const Table: typeof import('../components/table/table').default;
export const TableRow: typeof import('../components/table/table').TableRow;
export const TableCell: typeof import('../components/table/table').TableCell;
export const SelectableTable: typeof import('../components/selectable-table').default;
export const SelectableTableRow: typeof import('../components/selectable-table').SelectableTableRow;
export const SelectableTableCell: typeof import('../components/selectable-table').SelectableTableCell;
export const EditableTable: typeof import('../components/editable-table').default;
export const EditableTableCell: typeof import('../components/editable-table').EditableTableCell;
export const LazyRenderedList: typeof import('../components/lazy-rendered-list').default;
export const AttachmentItem: typeof import('../components/attachment-items');
export const ImageAttachmentItem: typeof import('../components/attachment-items');
export const CodeSnippet: typeof import('../components/code-snippet').default;

export const ComposerEditor: typeof import('../components/composer-editor/composer-editor').default;
export const ComposerSupport: typeof import('../components/composer-editor/composer-support');

export const ScrollRegion: typeof import('../components/scroll-region').default;
export const ResizableRegion: typeof import('../components/resizable-region').default;

export const MailLabel: typeof import('../components/mail-label');
export const LabelColorizer: typeof import('../components/mail-label');
export const MailLabelSet: typeof import('../components/mail-label-set').default;
export const MailImportantIcon: typeof import('../components/mail-important-icon').default;

export const ScenarioEditor: typeof import('../components/scenario-editor').default;

// Higher order components
export const ListensToObservable: typeof import('../components/decorators/listens-to-observable').default;
export const ListensToFluxStore: typeof import('../components/decorators/listens-to-flux-store').default;
export const ListensToMovementKeys: typeof import('../components/decorators/listens-to-movement-keys').default;
export const HasTutorialTip: typeof import('../components/decorators/has-tutorial-tip').default;
export const CreateButtonGroup: typeof import('../components/decorators/create-button-group').default;
}