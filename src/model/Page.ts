import { WebContentsView } from 'electron';

export interface PlainPage {
  id?: string;
  label?: string;
  url?: string;
  session?: string;
  persist?: boolean;
}

export type PageView = WebContentsView & { isReady?: boolean };

export class Page {
  public static readonly MARGIN = { x: 30, y: 30 };
  public static readonly DEFAULT_SESSION = 'Default';
  private _id?: string;
  private _label: string;
  private _url: string;
  private _view?: PageView;
  private _onViewChange?: (page: Page, view?: PageView, previousView?: PageView) => void;
  private _session: string;
  private _persist: boolean;
  private _hasBounds?: true;

  constructor(
    id: string | undefined,
    label: string,
    url?: string,
    view?: PageView,
    session?: string,
    persist?: boolean,
  ) {
    this._id = id;
    this._label = label;
    this._url = url ?? '';
    this._view = view;
    this._session = session !== void 0 && session !== '' ? session : Page.DEFAULT_SESSION;
    this._persist = persist ?? false;
  }

  public toPlainPage(): PlainPage {
    return {
      id: this._id,
      label: this._label,
      url: this._url,
      session: this._session !== Page.DEFAULT_SESSION ? this._session : '',
      persist: this._persist,
    };
  }

  public static fromPlainPage(plain: PlainPage): Page {
    return new Page(
      plain.id,
      plain.label!,
      plain.url,
      undefined,
      plain.session!,
      plain.persist!,
    );
  }

  public static fromList(plainPages: PlainPage[]): Page[] {
    return plainPages.map((plain) => Page.fromPlainPage(plain));
  }

  get id(): string | undefined {
    return this._id;
  }

  set id(value: string | undefined) {
    this._id = value;
  }

  get label(): string {
    return this._label;
  }

  set label(value: string) {
    this._label = value;
  }

  get labelWithStatus(): string {
    let label = this._label;
    if (this._view) {
      label += ' ❏';
      const wc = this._view.webContents;
      !wc.isDestroyed() && wc.isAudioMuted() && (label += ' ✕');
    }
    return label;
  }

  get url(): string {
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  get view(): PageView | undefined {
    return this._view;
  }

  set view(value: PageView | undefined) {
    if (this._view === value) { return; }
    const previousView = this._view;
    this._view = value;
    this._onViewChange?.(this, value, previousView);
  }

  public setViewChangeHandler(
    handler?: (page: Page, view?: PageView, previousView?: PageView) => void,
  ): void {
    this._onViewChange = handler;
  }

  get hasView(): boolean {
    return !!this._view;
  }

  get session(): string {
    return this._session;
  }

  set session(value: string) {
    this._session = value;
  }

  get persist(): boolean {
    return this._persist;
  }

  set persist(value: boolean) {
    this._persist = value;
  }

  get hasBounds(): true | undefined {
    return this._hasBounds;
  }

  set hasBounds(value: true | undefined) {
    this._hasBounds = value;
  }

  get isValid(): boolean {
    return this._label && this.hasValidUrl ? true : false;
  }

  get hasValidUrl(): boolean {
    return Page.isValidUrl(this._url);
  }

  public static isValidUrl(url: string): boolean {
    return !!url && (url.includes('://') || url.startsWith('data:'));
  }
}
