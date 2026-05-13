import { z } from 'zod'
import SectionFieldRow from './sectionFieldRow.jsx'
import styles from './BibleSectionPanel.module.css'

/**
 * @typedef {'approved' | 'rejected' | 'pending'} ApprovalState
 */

/**
 * @param {object} props
 * @param {string} props.sectionName
 * @param {import('zod').ZodObject<any>} props.sectionSchema
 * @param {Record<string, unknown>} props.values
 * @param {Record<string, unknown>} [props.provenance]
 * @param {(field: string, value: string) => void} [props.onChange]
 * @param {ApprovalState} props.approvalState
 * @param {() => void} [props.onApprove]
 * @param {() => void} [props.onReject]
 */
export default function BibleSectionPanel({
  sectionName,
  sectionSchema,
  values = {},
  provenance = {},
  onChange,
  approvalState,
  onApprove,
  onReject,
}) {
  if (!(sectionSchema instanceof z.ZodObject)) {
    throw new TypeError('BibleSectionPanel expects sectionSchema to be a ZodObject')
  }

  const readOnly = typeof onChange !== 'function'
  const shape = sectionSchema.shape
  const keys = Object.keys(shape).sort()

  const badgeClass =
    approvalState === 'approved'
      ? styles.approved
      : approvalState === 'rejected'
        ? styles.rejected
        : styles.pending

  return (
    <section className={styles.panel} data-testid="T_BIBLE_SECTION_PANEL" data-section={sectionName}>
      <div className={styles.header}>
        <div className={styles.sectionTitle}>{sectionName}</div>
        <span
          className={`${styles.approvalBadge} ${badgeClass}`}
          data-testid="T_BIBLE_SECTION_APPROVAL"
          data-state={approvalState}
        >
          {approvalState}
        </span>
      </div>
      {keys.map((key) => (
        <SectionFieldRow
          key={key}
          fieldKey={key}
          fieldSchema={shape[key]}
          value={values[key]}
          provenance={provenance}
          onChange={onChange}
        />
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          data-testid="T_BIBLE_APPROVE"
          disabled={readOnly || typeof onApprove !== 'function'}
          onClick={() => onApprove?.()}
        >
          Approve
        </button>
        <button
          type="button"
          className={styles.button}
          data-testid="T_BIBLE_REJECT"
          disabled={readOnly || typeof onReject !== 'function'}
          onClick={() => onReject?.()}
        >
          Reject
        </button>
      </div>
    </section>
  )
}
