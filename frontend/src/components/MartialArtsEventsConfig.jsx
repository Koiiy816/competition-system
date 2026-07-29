import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const EventItem = React.forwardRef(({ event, index, onEventChange, onRemoveEvent, provided, snapshot }, ref) => {
  return (
    <div
      ref={ref}
      {...provided.draggableProps}
      style={{
        ...provided.draggableProps.style,
        marginBottom: '8px',
      }}
    >
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls={`panel${index}-content`}
          id={`panel${index}-header`}
          sx={{
            backgroundColor: snapshot.isDragging ? '#e3f2fd' : 'white',
            borderRadius: '4px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div {...provided.dragHandleProps}>
              <DragIndicatorIcon sx={{ cursor: 'grab' }} />
            </div>
            <Typography variant="subtitle1" sx={{ flexGrow: 1, ml: 1 }}>
              {event.name || `项目 ${index + 1}`}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation(); // 防止点击删除按钮时展开/折叠 Accordion
                onRemoveEvent(event.id);
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            label="项目名称"
            variant="outlined"
            value={event.name}
            onChange={(e) => onEventChange(event.id, 'name', e.target.value)}
            sx={{ mt: 1 }}
          />
          {/* 在这里可以为 event 的其他属性添加更多的输入字段 */}
        </AccordionDetails>
      </Accordion>
    </div>
  );
});

const MartialArtsEventsConfig = ({ events = [], onEventChange, onAddEvent, onRemoveEvent, onDragEnd }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          武术比赛项目配置
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            • 传统项目默认不计入团体总分<br/>
            • 集体项目支持线上预赛和视频提交<br/>
            • 小学乙组集体项目超过200人需要线上预赛
          </Typography>
        </Alert>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="events-droppable">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {events.map((event, index) => (
                  <Draggable key={event.id} draggableId={String(event.id)} index={index}>
                    {(provided, snapshot) => (
                      <EventItem
                        ref={provided.innerRef}
                        provided={provided}
                        snapshot={snapshot}
                        event={event}
                        index={index}
                        onEventChange={onEventChange}
                        onRemoveEvent={onRemoveEvent}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button
          startIcon={<AddIcon />}
          onClick={onAddEvent}
          variant="outlined"
          sx={{ mt: 2 }}
        >
          添加比赛项目
        </Button>
      </CardContent>
    </Card>
  );
};

export default MartialArtsEventsConfig;