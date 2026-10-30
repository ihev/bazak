import type { ProductGroup } from '@bazak/contracts';
import { ProductCard } from './ProductCard';
import styles from './ProductResults.module.css';

export function ProductResults({ groups }: { groups: ProductGroup[] }) {
  return (
    <div className={styles.results}>
      {groups.map((group, index) => (
        <section key={`${group.label}-${index}`} aria-label={group.label}>
          <div className={styles.heading}>
            <h3>{group.label}</h3>
            <span>{group.totalMatches} matches</span>
          </div>
          {group.note && <p className={styles.note}>{group.note}</p>}
          {group.products.length ? (
            <div className={styles.grid}>
              {group.products.map((product) => (
                <ProductCard key={`${product.id}-${product.image}`} product={product} />
              ))}
            </div>
          ) : (
            <p className={styles.note}>No products match these criteria.</p>
          )}
        </section>
      ))}
    </div>
  );
}
