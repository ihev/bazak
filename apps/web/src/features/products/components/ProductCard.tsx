import { useState } from 'react';
import type { Product } from '@bazak/contracts';
import styles from './ProductCard.module.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className={styles.card}>
      <div className={styles.image}>
        {product.image && !imageFailed ? (
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>Image unavailable</span>
        )}
      </div>
      <div className={styles.details}>
        <h4>{product.title}</h4>
        <p className={styles.description}>{product.description}</p>
        <p className={styles.price}>{money.format(product.price)}</p>
      </div>
    </article>
  );
}
