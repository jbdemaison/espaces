import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
  VariantType,
} from '@gouvfr-lasuite/ui-components';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Box, ButtonCloseModal, Text, TextErrors } from '@/components';
import { useConfig } from '@/core';
import { KEY_LIST_DOC_TRASHBIN } from '@/docs/docs-grid';
import { useToast } from '@/hooks';

import { KEY_DOC, KEY_LIST_FAVORITE_DOC } from '../api';
import { KEY_LIST_DOC } from '../api/useDocs';
import { useRemoveDoc } from '../api/useRemoveDoc';
import { useDocUtils } from '../hooks';
import { Doc } from '../types';

interface ModalRemoveDocProps {
  doc: Doc;
  onClose: () => void;
  onSuccess?: (doc: Doc) => void;
}

/** Two numbers of one digit whose sum also has one digit: "3 + 4". */
const randomSum = () => {
  const a = 1 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * (9 - a));
  return { a, b };
};

export const ModalRemoveDoc = ({
  doc,
  onClose,
  onSuccess,
}: ModalRemoveDocProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const trashBinCutoffDays = config?.TRASHBIN_CUTOFF_DAYS || 30;
  const { hasChildren } = useDocUtils(doc);
  const cancelButtonRef = useRef<ButtonElement>(null);
  // A space or a room is not deleted by mistake: a small sum has to be answered
  const needsCheck = doc.kind === 'folder' || doc.kind === 'room';
  const [sum] = useState(randomSum);
  const [answer, setAnswer] = useState('');
  const checked = !needsCheck || answer.trim() === String(sum.a + sum.b);

  const {
    mutate: removeDoc,
    isError,
    error,
  } = useRemoveDoc({
    listInvalidQueries: [
      KEY_LIST_DOC,
      KEY_LIST_DOC_TRASHBIN,
      KEY_DOC,
      KEY_LIST_FAVORITE_DOC,
    ],
    options: {
      onSuccess: () => {
        if (onSuccess) {
          onSuccess(doc);
        }

        onClose();

        toast(
          t('The document has been deleted.', {
            description: 'Toast shown after deleting a document',
          }),
          VariantType.SUCCESS,
          {
            duration: 4000,
          },
        );
      },
    },
  });
  // react-aria Popover restores focus to its trigger asynchronously
  // when closing, which races with autoFocus when the modal is opened
  // from a dropdown. This ensures focus wins after that restoration.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDelete = () => {
    removeDoc({ docId: doc.id });
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      hideCloseButton
      onClose={onClose}
      aria-label={t('Delete a doc', {
        description: 'Title and accessible name of the delete document dialog',
      })}
      rightActions={
        <>
          <Button
            ref={cancelButtonRef}
            aria-label={t('Cancel the deletion', {
              description:
                'Accessible name of the button cancelling the deletion',
            })}
            variant="secondary"
            fullWidth
            autoFocus
            onClick={onClose}
          >
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            aria-label={t('Delete document', {
              description:
                'Accessible name of the button confirming the deletion',
            })}
            color="error"
            fullWidth
            disabled={!checked}
            onClick={handleDelete}
          >
            {t('Delete', {
              description: 'Dropdown menu item to delete the document',
            })}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <>
          <Text
            $size="h6"
            as="h1"
            id="modal-remove-doc-title"
            $margin="0"
            $align="flex-start"
          >
            {t('Delete a doc', {
              description:
                'Title and accessible name of the delete document dialog',
            })}
          </Text>
          <Box $position="absolute" $css="top: 8px; right: 8px;">
            <ButtonCloseModal
              aria-label={t('Close the delete modal', {
                description:
                  'Accessible name of the button closing the delete dialog',
              })}
              onClick={onClose}
            />
          </Box>
        </>
      }
    >
      <Box className="--docs--modal-remove-doc">
        {!isError && (
          <Text
            $size="sm"
            $variation="secondary"
            $display="inline-block"
            as="p"
          >
            {hasChildren ? (
              <Trans t={t}>
                This document and <strong>any sub-documents</strong> will be
                placed in the trashbin. You can restore it within{' '}
                {{ days: trashBinCutoffDays }} days.
              </Trans>
            ) : (
              t(
                'This document will be placed in the trashbin. You can restore it within {{days}} days.',
                {
                  description: 'Explanation in the delete dialog',
                  days: trashBinCutoffDays,
                },
              )
            )}
          </Text>
        )}

        {needsCheck && !isError && (
          <Box $margin={{ top: 'sm' }}>
            <label htmlFor="remove-doc-sum">
              <Text $size="sm" as="span">
                {t('To confirm, type the result of {{a}} + {{b}}:', {
                  a: sum.a,
                  b: sum.b,
                  description: 'Check asked before deleting a space or a room',
                })}
              </Text>
            </label>
            <input
              id="remove-doc-sum"
              data-testid="remove-doc-sum"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && checked) {
                  handleDelete();
                }
              }}
              style={{
                display: 'block',
                width: 80,
                marginTop: 8,
                padding: '8px 12px',
                font: 'inherit',
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </Box>
        )}

        {isError && <TextErrors causes={error.cause} />}
      </Box>
    </Modal>
  );
};
