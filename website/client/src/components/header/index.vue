<template>
  <div>
    <div
      id="app-header"
      class="row"
      :class="{'hide-header': hideHeader}"
    >
      <div class="d-flex align-items-center header-name">
        <h3 class="character-name mb-0">
          {{ user.profile.name }}
        </h3>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import '@/assets/scss/colors.scss';

  #app-header {
    padding-left: 24px;
    padding-top: 9px;
    padding-bottom: 8px;
    background: $purple-50;
    color: $header-color;
    flex-wrap: nowrap;
    position: relative;
  }

  .hide-header {
    display: none;
  }

  .header-name {
    padding: 8px 0;
  }

  .character-name {
    color: $white;
    font-size: 16px;
  }
</style>

<script>
import { mapGetters } from '@/libs/store';

export default {
  computed: {
    ...mapGetters({
      user: 'user:data',
    }),
    hideHeader () {
      return ['groupPlan', 'privateMessages'].includes(this.$route.name);
    },
  },
};
</script>
