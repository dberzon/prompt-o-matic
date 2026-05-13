import { readSectionRequirement } from '../../../api/lib/bibles/schemas/_sectionMarkers.js'
import styles from './BibleSectionPanel.module.css'

/**
 * @param {object} props
 * @param {string} props.fieldKey
 * @param {import('zod').ZodTypeAny} props.fieldSchema
 * @param {unknown} props.value
 * @param {Record<string, unknown>} [props.provenance]
 * @param {(field: string, value: string) => void} [props.onChange]
 */
export default function SectionFieldRow({ fieldKey, fieldSchema, value, provenance = {}, onChange }) {
  const metaReq = readSectionRequirement(fieldSchema)
  const requirement =
    metaReq ?? (typeof fieldSchema.isOptional === 'function' && fieldSchema.isOptional() ? 'recommended' : 'required')
  const str = value === undefined || value === null ? '' : String(value)
  const missing = str.trim() === ''
  const highlight = missing && requirement === 'required' ? styles.missingRequired : ''
  const softMissing = missing && requirement === 'recommended' ? styles.missingRecommended : ''
  const readOnly = typeof onChange !== 'function'
  const prov = provenance[fieldKey]

  return (
    <div
      className={`${styles.fieldRow} ${highlight} ${softMissing}`}
      data-testid="T_BIBLE_SECTION_FIELD_ROW"
      data-field={fieldKey}
      data-requirement={requirement}
      data-missing={missing ? '1' : '0'}
    >
      <div className={styles.fieldHeader}>
        <span className={styles.fieldKey}>{fieldKey}</span>
        <span className={requirement === 'required' ? styles.badgeRequired : styles.badgeRecommended}>
          {requirement}
        </span>
        {prov !== undefined && prov !== null && (
          <span className={styles.provenance} data-testid="T_BIBLE_FIELD_PROVENANCE">
            {String(prov)}
          </span>
        )}
      </div>
      {readOnly ? (
        <div className={styles.readonlyValue} data-testid="T_BIBLE_FIELD_READONLY">
          {str || '—'}
        </div>
      ) : (
        <input
          className={styles.input}
          aria-label={fieldKey}
          data-testid={`T_BIBLE_FIELD_INPUT_${fieldKey}`}
          value={str}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
      )}
    </div>
  )
}
