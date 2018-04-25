import { types, util } from 'vortex-api';

import * as actions from '../actions/userlist';

type RuleType = 'after' | 'requires' | 'incompatible';

function listForType(type: string) {
  switch (type) {
    case 'requires': return 'req';
    case 'incompatible': return 'inc';
    default: return 'after';
  }
}

/**
 * reducer for changes to settings regarding mods
 */
const userlistReducer: types.IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.hasOwnProperty('userlist')) {
        return util.setSafe(state, [], payload.userlist);
      } else {
        return state;
      }
    },
    [actions.addRule as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        const statePath = ['plugins', existing, list];
        if (util.getSafe(state, statePath, []).indexOf(payload.reference) !== -1) {
          return state;
        }
        return util.pushSafe(state, statePath, payload.reference);
      } else {
        const res = util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          [list]: [ payload.reference ],
        });
        return res;
      }
    },
    [actions.removeRule as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      const list = listForType(payload.type);
      if (existing !== -1) {
        return util.removeValue(state, ['plugins', existing, list], payload.reference);
      } else {
        return state;
      }
    },
    [actions.addGroup as any]: (state, payload) =>
      (state.groups.find(group => group.name === payload.group) === undefined)
        ? util.pushSafe(state, ['groups'], {
          name: payload.group,
          after: [ 'default' ],
        })
        : state,
    [actions.setGroup as any]: (state, payload) => {
      let existing: number = -1;
      if (state.plugins !== undefined) {
        existing = state.plugins.findIndex(plug => plug.name === payload.pluginId);
      }
      return (existing !== -1)
        ? util.setSafe(state, ['plugins', existing, 'group'],  payload.group)
        : util.pushSafe(state, ['plugins'], {
          name: payload.pluginId,
          group: payload.group,
        });
    },
  },
  defaults: {
  },
};

export default userlistReducer;
