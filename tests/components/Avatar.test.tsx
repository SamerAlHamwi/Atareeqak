import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Avatar from '../../src/features/shared/components/Avatar';
import { initialsOf } from '../../src/features/shared/initials';

describe('initialsOf', () => {
  it('takes up to two initials', () => {
    expect(initialsOf('Driver10 Test')).toBe('DT');
    expect(initialsOf('Omar')).toBe('O');
    expect(initialsOf('Omar Khaled Al Sayed')).toBe('OK');
  });

  it('handles Arabic names by code point, not byte', () => {
    expect(initialsOf('عمر خالد')).toBe('عخ');
  });

  it('falls back to ? rather than rendering nothing', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('renders initials when there is no photo — no outbound request', () => {
    const { container } = render(<Avatar name="Driver10 Test" photo={null} />);

    expect(screen.getByText('DT')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the server photo when one is present', () => {
    const src = 'http://127.0.0.1:8000/storage/profiles/p.jpg';
    render(<Avatar name="Driver10 Test" photo={src} />);

    const img = screen.getByAltText('Driver10 Test') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(src);
  });

  it('degrades to initials when the photo URL fails to load', () => {
    render(<Avatar name="Driver10 Test" photo="http://127.0.0.1:8000/gone.jpg" />);

    fireEvent.error(screen.getByAltText('Driver10 Test'));
    expect(screen.getByText('DT')).toBeTruthy();
  });

  it('retries on a new URL instead of staying stuck on the failed one', () => {
    const { rerender } = render(<Avatar name="A B" photo="http://host/one.jpg" />);
    fireEvent.error(screen.getByAltText('A B'));
    expect(screen.getByText('AB')).toBeTruthy();

    rerender(<Avatar name="A B" photo="http://host/two.jpg" />);
    const img = screen.getByAltText('A B') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('http://host/two.jpg');
  });
});
