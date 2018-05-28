import * as cytoscape from 'cytoscape';
import * as coseBilkent from 'cytoscape-cose-bilkent';
import * as edgehandles from 'cytoscape-edgehandles';
import * as _ from 'lodash';
import * as React from 'react';
import { util } from 'vortex-api';

(cytoscape as any).use(edgehandles);
(cytoscape as any).use(coseBilkent);

export interface IGraphElement {
  title: string;
  class: string;
  connections: string[];
  readonly?: boolean;
}

export interface IGraphSelection {
  source?: string;
  target?: string;
  id?: string;
  readonly?: boolean;
}

export interface IGraphViewProps {
  elements: { [id: string]: IGraphElement };
  className: string;
  style?: React.CSSProperties;
  visualStyle: cytoscape.Stylesheet[];
  onConnect: (source: string, target: string) => void;
  onDisconnect: (source: string, target: string) => void;
  onRemove: (id: string) => void;
  onContext: (x: number, y: number, selection: IGraphSelection) => void;
}

function san(input: string): string {
  return input.replace(/ /g, '_');
}

class GraphView extends React.Component<IGraphViewProps, {}> {
  private mRef: HTMLDivElement;
  private mGraph: cytoscape.Core;
  private mLayout: cytoscape.LayoutManipulation;

  public componentWillReceiveProps(newProps: IGraphViewProps) {
    if (newProps.elements !== this.props.elements) {
      const changed = (util as any).objDiff(this.props.elements, newProps.elements);

      Object.keys(changed).forEach(id => {
        if (id[0] === '+') {
          // node added
          this.mGraph.add({
            data: { id: san(id.slice(1)), title: changed[id].title },
            classes: changed[id].class,
          });
          const connections = changed[id].connections;
          Object.keys(connections || []).forEach(refId => {
            const from = san(id.slice(1));
            const to = san(connections[refId]);
            this.mGraph.add({
              data: {
                id: `${from}-to-${to}`,
                source: to,
                sourceOrig: connections[refId],
                target: from,
                targetOrig: id.slice(1),
              },
              classes: newProps.elements[id].class,
            });
          });
        } else if (id[0] === '-') {
          // node removed
          this.mGraph.remove('#' + san(id.slice(1)));
        } else {
          // node content changed
          Object.keys(changed[id].connections || []).forEach(refId => {
            const from = san(id);
            const to = san(changed[id].connections[refId]);
            const connId = `${from}-to-${to}`;
            if (refId[0] === '-') {
              this.mGraph.remove('#' + connId);
            } else if (refId[0] === '+') {
              this.mGraph.add({
                data: {
                  id: connId,
                  source: to,
                  sourceOrig: changed[id].connections[refId],
                  target: from,
                  targetOrig: id,
                },
                classes: newProps.elements[id].class,
              });
            }
          });
        }
      });
      this.mLayout.run();
    }
  }

  public layout() {
    this.mLayout.run();
  }

  public render(): JSX.Element {
    const { className, style } = this.props;

    return <div ref={this.setRef} className={className} style={style} />;
  }

  private setRef = (ref: HTMLDivElement) => {
    const { className, elements, visualStyle } = this.props;
    this.mRef = ref;
    if (ref === null) {
      this.mGraph = undefined;
      return;
    }
    this.mGraph = cytoscape({
      container: ref,
      style: visualStyle,
      minZoom: 0.33,
      maxZoom: 3,
      wheelSensitivity: 0.25,
    });
    this.addElements(elements);
    this.mGraph.resize();
    this.mGraph.center();
    this.mLayout = this.mGraph.layout({
      name: 'cose-bilkent',
      nodeDimensionsIncludeLabels: true,
      randomize: false,
    } as any);
    this.mLayout.run();
    (this.mGraph as any).edgehandles({
      handlePosition: () => 'middle middle',
      edgeParams: () => ({ classes: className + '-edge' }),
      loopAllowed: () => false,
    });
    (this.mGraph as any).on('cxttap', this.handleContext);
    (this.mGraph as any).on('ehcomplete', (evt, source, target, added) => {
      this.props.onConnect(source.data().title, target.data().title);
      // remove the automatically created edge so we can add our own, in sync with the backend data
      if (added.data() !== undefined) {
        this.mGraph.remove('#' + added.data().id);
      }
    });
  }

  private handleContext = (evt: cytoscape.EventObject) => {
    let selection;
    if (evt.target.data !== undefined) {
      const data = evt.target.data();
      if ((data.title === undefined) && (data.source === undefined)) {
        // an item was hit, but neither a node nor an edge. Probably the edge handle
        return;
      }
      selection = (data.source !== undefined)
        ? { source: data.sourceOrig, target: data.targetOrig, readonly: data.readonly }
        : { id: data.title, readonly: data.readonly };
    }
    this.props.onContext(evt.renderedPosition.x, evt.renderedPosition.y, selection);
  }

  private addElements(elements: { [id: string]: IGraphElement }) {
    this.mGraph
      .add(Object.keys(elements).reduce((prev, id: string, idx: number) => {
        const ele = elements[id];
        prev.push({
          data: { id: san(id), title: ele.title, readonly: ele.readonly },
          classes: ele.class,
          position: { x: idx * 2, y: idx },
        });
        (ele.connections || []).forEach(conn => {
          prev.push({
            data: {
              id: san(`${id}-to-${san(conn)}`),
              target: san(id),
              source: san(conn),
              targetOrig: id,
              sourceOrig: conn,
              readonly: ele.readonly,
            },
            classes: ele.class,
          });
        });
        return prev;
      }, []));
  }
}

export default GraphView;