import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '~/App';
import { Sources } from '~/components/Sources';
import { setLocale } from '~/lib/i18n';
import { ChoiceTabs, VirtualGrid } from '~/ui';

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = '#/';
  setLocale('en');
});

describe('Wachcha UI components & App shell', () => {
  it('ChoiceTabs confirms selection immediately and ignores re-selecting active value', () => {
    const onChange = vi.fn();
    render(
      <ChoiceTabs
        value="anime"
        onChange={onChange}
        options={[
          { value: 'anime', label: 'Anime' },
          { value: 'turkish-dizi', label: 'Turkish Dizis' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Anime' }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Turkish Dizis' }));
    expect(onChange).toHaveBeenCalledWith('turkish-dizi');
    expect(screen.getByRole('tab', { name: 'Turkish Dizis' }).getAttribute('aria-selected')).toBe(
      'true'
    );
  });

  it('VirtualGrid renders bounded DOM window for large catalogs (> 60 items)', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i, title: `Title #${i}` }));
    const { container } = render(
      <VirtualGrid
        items={items}
        itemKey={x => x.id}
        renderItem={x => <button type="button">{x.title}</button>}
      />
    );
    const root = container.querySelector('[data-virtual-total]');
    expect(root?.getAttribute('data-virtual-total')).toBe('500');
    const rendered = Number(root?.getAttribute('data-virtual-rendered'));
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(150);
  });

  it('Sources screen lists built-in providers and installs/removes Stremio addons', async () => {
    render(<Sources />);
    expect(await screen.findByText('AniLiberty API v1')).toBeTruthy();
    expect(screen.getByText('Turkish Official Broadcasters')).toBeTruthy();

    const input = screen.getByPlaceholderText('https://addon.example.org/manifest.json');
    fireEvent.input(input, { target: { value: 'https://demo.addon.org/manifest.json' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Install' }));

    expect(await screen.findByText('demo.addon.org')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('AniLiberty API v1')).toBeTruthy();
  });

  it('App shell switches languages live across EN, RU, and TR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    );
    render(<App />);
    expect(screen.getByText('WACHCHA')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'RU' }));
    expect((await screen.findAllByText('Турецкие сериалы')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'TR' }));
    expect((await screen.findAllByText('Türk Dizileri')).length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
