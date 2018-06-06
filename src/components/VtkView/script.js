let subscriptions = [];

function onMounted() {
  const container = this.$el;

  this.view = this.proxyManager.createProxy('Views', 'View3D');
  this.view.setContainer(container);
  this.view.resetCamera();
  this.view.resize();

  window.addEventListener('resize', this.view.resize);

  subscriptions = [
    {
      unsubscribe: () => window.removeEventListener('resize', this.view.resize),
    },
  ];
}

function onBeforeDestroy() {
  while (subscriptions.length) {
    subscriptions.pop().unsubscribe();
  }
}

export default {
  inject: ['proxyManager'],
  data: () => ({
    view: null,
  }),
  mounted() {
    this.$nextTick(onMounted);
  },
  beforeDestroy: onBeforeDestroy,
};
