<template>
  <fragment>
  </fragment>
</template>

<script>
import { mapState } from '@/libs/store';

export default {
  name: 'LoginMethods',
  data () {
    return {
      localAuth: {
        password: '',
        confirmPassword: '',
      },
    };
  },
  computed: {
    ...mapState({
      user: 'user.data',
      content: 'content',
    }),
  },
  mounted () {
    this.$store.dispatch('common:setTitle', {
      section: this.$t('settings'),
    });

    const focusID = this.$route.query.focus;
    if (focusID !== undefined && focusID !== null) {
      this.$nextTick(() => {
        const element = document.getElementById(focusID);
        if (element !== undefined && element !== null) {
          element.focus();
        }
      });
    }
  },
};
</script>
