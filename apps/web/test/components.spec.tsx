import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageComposer } from '../src/features/chat/components/MessageComposer';
import { ProductCard } from '../src/features/products/components/ProductCard';

describe('message composer', () => {
  it('rejects blank input, preserves Shift+Enter, trims and clears a submitted message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<MessageComposer disabled={false} onSend={onSend} />);
    const input = screen.getByRole('textbox', { name: 'Your message' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(input, '  Find phones');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('  Find phones\n');
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledExactlyOnceWith('Find phones');
    expect(input).toHaveValue('');
  });

  it('does not submit while disabled or during an IME composition', () => {
    const onSend = vi.fn();
    const { rerender } = render(<MessageComposer disabled={false} onSend={onSend} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Phone' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    rerender(<MessageComposer disabled={true} onSend={onSend} />);
    fireEvent.submit(input.closest('form')!);
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
  });
});

describe('product card', () => {
  const product = {
    id: 1,
    title: 'Phone',
    description: 'Everyday use',
    price: 99.5,
    image: 'https://example.test/phone.jpg',
  };
  it('renders factual fields, USD pricing and an accessible image fallback on load failure', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole('heading', { name: 'Phone' })).toBeVisible();
    expect(screen.getByText('Everyday use')).toBeVisible();
    expect(screen.getByText('$99.50')).toBeVisible();
    fireEvent.error(screen.getByRole('img', { name: 'Phone' }));
    expect(screen.getByText('Image unavailable')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('shows the fallback immediately when no safe image is available', () => {
    render(<ProductCard product={{ ...product, image: null }} />);
    expect(screen.getByText('Image unavailable')).toBeVisible();
  });
});
