import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { FamilyNode } from '../types/graph';

const LIST_CAP = 10;

interface NewMembersModalProps {
  open: boolean;
  onClose: () => void;
  members: FamilyNode[];
}

function clusterLine(n: FamilyNode): string | undefined {
  const cluster = n.familyCluster ?? n.maternalFamilyCluster;
  return cluster ? `${cluster} family` : undefined;
}

export const NewMembersModal: React.FC<NewMembersModalProps> = ({ open, onClose, members }) => {
  const shown = members.slice(0, LIST_CAP);
  const remainder = Math.max(0, members.length - LIST_CAP);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      sx={{
        '& .MuiDialog-paper': {
          maxWidth: 300,
          width: '100%',
          mx: 2,
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center' }}>New family members</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: 360 }}>
        <List dense disablePadding>
          {shown.map((n) => (
            <ListItem key={n.id} disableGutters sx={{ justifyContent: 'center', textAlign: 'center' }}>
              <ListItemText
                primary={n.firstName || 'Unknown'}
                secondary={clusterLine(n)}
                sx={{ textAlign: 'center' }}
              />
            </ListItem>
          ))}
        </List>
        {remainder > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'center' }}>
            +{remainder} more
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
