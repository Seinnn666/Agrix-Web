import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import HoverPressable from './HoverPressable';
import { theme } from '../ui/theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';
  const [portalNode, setPortalNode] = React.useState(null);
  const reactDom = React.useMemo(() => {
    if (!isWeb) return null;
    try {
      return require('react-dom');
    } catch (_err) {
      return null;
    }
  }, [isWeb]);

  React.useEffect(() => {
    if (!isWeb || !visible) return undefined;
    const node = document.createElement('div');
    node.setAttribute('data-agrix-modal-root', 'true');
    node.style.position = 'fixed';
    node.style.inset = '0';
    node.style.zIndex = '3000';
    document.body.appendChild(node);
    setPortalNode(node);
    return () => {
      setPortalNode(null);
      try {
        document.body.removeChild(node);
      } catch (_err) {
      }
    };
  }, [isWeb, visible]);

  React.useEffect(() => {
    if (!isWeb || !visible) return undefined;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    const preventScroll = (e) => {
      e.preventDefault();
    };
    const preventKeys = (e) => {
      const key = e.key;
      if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'PageDown' ||
        key === 'PageUp' ||
        key === 'Home' ||
        key === 'End' ||
        key === ' ' ||
        key === 'Spacebar'
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', preventKeys, { passive: false });
    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('keydown', preventKeys);
    };
  }, [isWeb, visible]);

  if (!visible) return null;

  const showCancel = Boolean(cancelText);
  const handleCancel = () => {
    if (typeof onCancel === 'function') onCancel();
  };
  const handleConfirm = () => {
    if (typeof onConfirm === 'function') onConfirm();
  };

  const content = (
    <View pointerEvents="auto" style={styles.portal}>
      <HoverPressable style={styles.backdrop} onPress={handleCancel} />
      <View style={styles.dialog} accessibilityRole="dialog" aria-modal="true">
        {!!title ? <Text style={styles.title}>{title}</Text> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>
          {showCancel ? (
            <HoverPressable style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
              <Text style={[styles.buttonText, styles.cancelText]}>{cancelText}</Text>
            </HoverPressable>
          ) : null}
          <HoverPressable
            style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
            onPress={handleConfirm}
          >
            <Text style={[styles.buttonText, destructive ? styles.destructiveText : styles.confirmText]}>
              {confirmText}
            </Text>
          </HoverPressable>
        </View>
      </View>
    </View>
  );

  if (isWeb && reactDom?.createPortal && portalNode) {
    return reactDom.createPortal(content, portalNode);
  }
  return content;
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlayDark,
  },
  dialog: {
    width: '92%',
    maxWidth: 520,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
      },
    }),
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  button: {
    minWidth: 110,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: theme.colors.border,
  },
  confirmButton: {
    backgroundColor: theme.colors.brand,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  destructiveButton: {
    backgroundColor: theme.colors.brandDark,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  buttonText: {
    fontWeight: '900',
    fontSize: 14,
  },
  cancelText: {
    color: theme.colors.text,
  },
  confirmText: {
    color: '#fff',
  },
  destructiveText: {
    color: '#fff',
  },
});

